# Android 위젯 데이터 동기화 아키텍처 재설계 — Design

- Date: 2026-07-09
- Related: `widget-preinstall-launch-fix` 메모리(2026-07-08~09 디버깅 세션), PR #157(v1.1.12)
- Scope: **Android only.** iOS(WidgetKit/App Group), RN JS 쪽 fetch 로직(`useSermonData`, `HomeScreen.init()`)은 변경하지 않는다.

## 1. Goal

1. 위젯이 항상 "관찰 가능한 state"를 그리도록 해서, FCM push / RN 브릿지 / WorkManager 중 누가 데이터를 갱신하든 위젯이 안정적으로 반영되게 한다.
2. "빈 데이터 상태를 렌더링해두고 나중에 `updateAll()`로 탈출을 시도하는" 패턴을 제거해서, 이번 세션에 재현한 "`updateAll()`을 여러 번 불러도 `provideGlance()`가 재호출되지 않는" 증상을 구조적으로 없앤다.
3. 앱 미실행 상태로 위젯을 설치할 때 간헐적으로 발생하는 네이티브 Firestore fetch 실패(Android App Standby `Never` bucket 추정)에 대한 정식 재시도 경로(WorkManager retry/backoff + 일 1회 periodic 안전망)를 마련한다.
4. JSON decode 실패 등 예외가 Glance의 네이티브 `errorUiLayout`으로 새어나가는 경로를 막아서, 에러 상태에서도 위젯 탭으로 앱을 열 수 있게 한다(실기기에서 탭이 안 먹히는 버그 확인됨).

## 2. Non-Goals

- iOS WidgetKit/App Group 변경
- RN JS 쪽 fetch 로직 변경 — `WidgetUpdateModule`의 JS 인터페이스 시그니처(`onSermonUpdated`/`onQtUpdated`/`onClear` 등)는 그대로 유지
- `updatePeriodMillis`(30분, legacy OS 스케줄러) 제거 — 보조 수단으로 유지
- 위젯 UI/디자인 변경(에러 상태 뷰 제외)
- Kotlin 테스트에 mockk 등 새 mocking 프레임워크 도입 — 기존 `FakeBibleDb` 스타일의 수동 Fake 패턴 유지

## 3. Key Decisions

| # | 주제 | 결정 | 근거 |
|---|------|------|------|
| 1 | 위젯 state 구독 방식 | Repository가 `StateFlow<WidgetContentState<T>>`를 노출하고, `provideGlance()`는 preload 후 `provideContent {}` 안에서 `collectAsState()`로 구독 | 공식 문서(`developer.android.com/develop/ui/compose/glance/glance-app-widget`)의 권장 예제 패턴과 동일. Glance 세션이 열려있는 동안(~45초) 데이터 변경을 놓치지 않음 |
| 2 | 위젯 갱신 트리거 | 모든 writer(FCM 서비스/RN 브릿지/WorkManager)는 `Repository.save()`만 호출. `save()` 내부에서 단 한 곳(`WidgetUpdateNotifier`)만 `updateAll()`을 호출 | 지금 6곳에서 각자 `updateAll()` + `enqueueWidgetInitialSync()`를 중복 호출하는 구조 제거. 매 push마다 방어적으로 워커를 재-enqueue할 필요 없어짐 |
| 3 | QT Repository 신설 | `QtRepository`/`QtRepositoryImpl`을 Sermon과 동일한 구조로 추출 | 지금 `GetDisplayQtUseCase`에 prefs+Firestore 로직이 직접 박혀있는 구조 불일치 해소 |
| 4 | Firestore fallback 조회 | `.get()` → `.get(Source.SERVER)`로 명시 | 지금은 서버 미도달 시 "조용한 빈 성공"(예외 없음)이라 재시도가 안 걸림 — 프로덕션 Crashlytics(`collection returned no documents`)와 이번 세션 재현 로그가 동일 시그니처. `Source.SERVER`는 미도달 시 진짜 예외를 던짐(Firestore 공식 문서 확인) |
| 5 | WorkManager 재시도 전략 | `WidgetInitialSyncWorker`의 수동 0/3초/8초 redraw 루프 제거. fetch 실패 시 `Result.retry()` 반환, 기존 `BackoffPolicy.EXPONENTIAL`(30초 base)에 위임 | 프레임워크가 이미 제공하는 재시도/backoff를 손으로 재구현하지 않음. 지금은 빈 fetch에도 `Result.success()`를 반환해 재시도가 아예 안 걸리는 결함이 있었음 |
| 6 | 주기적 안전망 | `WidgetPeriodicSyncWorker` 신규, 1일 1회 `PeriodicWorkRequest` | 설교(주 1회)/QT(일 1회) 갱신 주기상 "FCM 누락 대비 안전망"으로 하루 1회면 충분(사용자 확인) |
| 7 | 에러 처리 | JSON decode 실패 등은 Repository의 Flow 생성 로직에서 catch → `WidgetContentState.Error`로 매핑 → `ErrorView()` Composable로 렌더링. `errorUiLayout`/`onCompositionError()`는 최후의 안전망으로만 유지(Crashlytics 로깅 추가) | 공식 문서(`developer.android.com/develop/ui/compose/glance/error-handling`)가 명시한 두 갈래 전략: 예상 가능한 에러는 try-catch+Composable, 진짜 예상 못 한 크래시만 `errorUiLayout`. 지금 `errorUiLayout` XML엔 클릭 인텐트가 없어 이 상태에 빠지면 위젯 탭으로 복구가 불가능함(실기기 확인) |
| 8 | 배터리 영향 | 설계상 무관 | Glance 세션은 `update()` 호출당 ~45초 후 자동 종료. `collectAsState()` 구독도 그 세션 안에서만 유지되고, 별도의 상시 백그라운드 리스너를 새로 만들지 않음 |

## 4. Architecture

```
[FCM push]  [JS 브릿지(WidgetUpdateModule)]  [WorkManager(초기 1회 + 1일 1회)]
     └───────────────────┬───────────────────┘
                          ▼
           SermonRepository.save(dto) / QtRepository.save(dto)   ← 유일한 쓰기 경로
                          │
              ┌───────────┼────────────┐
              ▼                        ▼
       SharedPreferences        MutableStateFlow<WidgetContentState<Sermon>> 갱신
        (영속화, 프로세스 재시작 대비)          │
                                        ▼
                          WidgetUpdateNotifier.notifySermonChanged()
                                (updateAll() 딱 1번 호출)
                                        │
                                        ▼
                          provideGlance() 세션 열림(~45초)
                                        │
                     preload(현재 flow 값) → provideContent {
                         val state by repo.sermonFlow.collectAsState(initial = preload)
                         when (state) {
                             is Data -> Content(state.value)
                             is NoDataYet -> InstallGuideView(state.hasAppEverLaunched)
                             is Error -> ErrorView(retryAction)   // 클릭 시 앱 열림
                             Loading -> InstallGuideView(...)     // preload로 사실상 도달 안 함
                         }
                     }
```

**핵심 변화**: 지금은 `provideGlance()`가 데이터를 "한 번 읽고 그림"이라 그 이후 데이터가 바뀌면 별도의 `updateAll()` 호출이 `provideGlance()`를 다시 트리거해줘야만 반영됐다(그리고 이게 신뢰할 수 없다는 게 이번 세션에 재현됨). 새 구조에서는 세션이 열려있는 동안 Flow를 구독하므로, 세션 안에서 데이터가 바뀌면 재구성이 자동으로 일어난다. 세션이 이미 닫힌 뒤에 데이터가 바뀐 경우엔 여전히 `updateAll()` 한 번으로 새 세션을 열어야 하지만, 이건 각 writer가 흩어져서 중복 호출하던 지금과 달리 `save()` 내부 한 곳에서만 일어난다.

## 5. Data Model

```kotlin
// android/.../widget/state/WidgetContentState.kt (신규, Sermon/QT 공용)
sealed interface WidgetContentState<out T> {
    data object Loading : WidgetContentState<Nothing>
    data class Data<T>(val value: T) : WidgetContentState<T>
    data class NoDataYet(val hasAppEverLaunched: Boolean) : WidgetContentState<Nothing>
    data class Error(val throwable: Throwable) : WidgetContentState<Nothing>
}
```

- `Loading`: Repository의 `StateFlow` 초기값. `provideGlance()`가 `provideContent` 호출 전에 현재 값을 preload하므로, 실제로 최초 위젯 바인딩 시 극히 짧은 순간만 존재(공식 문서의 "avoid intermediate loading states" 권장과 일치하도록 preload로 최대한 건너뜀).
- `NoDataYet`: prefs도 비어있고 Firestore fallback도 실패한 "정상적인" 상태(설치 직후 등). 기존 `Sermon.noData(launched)`와 동일한 문구, 하지만 이제 위젯 탭으로 앱을 열면 정상 동작.
- `Error`: JSON decode 실패 등 진짜 처리 못 한 예외. `ErrorView`는 클릭하면 앱을 여는 `clickAction`을 반드시 포함(현재 `errorUiLayout`의 결함을 재발시키지 않기 위한 필수 조건).

## 6. Component Changes

| 파일 | 변경 내용 |
|---|---|
| `SermonRepository.kt`/`SermonRepositoryImpl.kt` | `suspend fun getDisplaySermon(): Sermon?` 제거 → `val sermonState: StateFlow<WidgetContentState<Sermon>>` 노출. `save(dto)` 메서드 신설: prefs 저장 + StateFlow 갱신 + `WidgetUpdateNotifier.notifySermonChanged()` 호출을 한 트랜잭션처럼 처리 |
| `QtRepository.kt`/`QtRepositoryImpl.kt` (신규) | Sermon과 동일 구조. `GetDisplayQtUseCase`의 로직을 이관 |
| `GetDisplaySermonUseCase.kt`/`GetDisplayQtUseCase.kt`/`SaveDisplaySermonUseCase.kt`/`SaveDisplayQtUseCase.kt`/`ClearWidgetPreferenceUseCase.kt` | **제거.** Repository가 이제 단일 접근 지점(`sermonState`/`qtState`, `save()`, `clear()`)이라 "그냥 위임만 하는" UseCase 계층이 불필요해짐. `provideGlance()`/Worker/브릿지 모두 `SermonRepository`/`QtRepository`를 직접 주입받음(`getWidgetDependencies()`/`getRNModuleDependencies()` 엔트리포인트는 유지, 노출 타입만 Repository로 교체) |
| `WidgetUpdateNotifier.kt`/`WidgetUpdateNotifierImpl.kt` (신규, `widget` 패키지) | `fun notifySermonChanged()` / `fun notifyQtChanged()` — 내부에서 `VerseWidgetLarge().updateAll(context)` 등 호출. data 계층이 Glance 타입을 직접 import하지 않도록 인터페이스로 분리, Hilt로 주입 |
| `SermonPrefsDataSource.kt`/`QtPrefsDataSource.kt` | `getDisplaySermon()`/`getDisplayQt()`가 decode 실패 시 `RuntimeException`을 던지던 것을 유지하되(호출부에서 catch), Repository가 이 예외를 잡아 `WidgetContentState.Error`로 변환 |
| `SermonFirestoreDataSource.kt`/`QtFirestoreDataSource.kt` | `.get()` → `.get(Source.SERVER)` |
| `VerseWidgetSmall.kt`/`Large.kt`, `QtWidgetSmall.kt`/`Large.kt` | `provideGlance()`: `repository.xxxState.value`로 preload → `provideContent { val state by repository.xxxState.collectAsState(initial = preload); WidgetContent(state) }`. `errorUiLayout`은 유지하되 `onCompositionError()`를 오버라이드해 Crashlytics 기록 추가 |
| `WidgetUpdateModule.kt` | `onSermonUpdated`/`onQtUpdated`/`onClear`가 `repository.save()`/`repository.clear()`만 호출. 직접 `updateAll()` + `enqueueWidgetInitialSync()` 호출 코드 제거 |
| `MyFirebaseMessagingService.kt` | `consumeSermonEvent`/`consumeQtEvent`가 `repository.save()`만 호출하도록 단순화 |
| `WidgetInitialSyncWorker.kt` | 0/3초/8초 수동 redraw 루프 제거. `repository.save()` 결과에 따라 `Result.success()`/`Result.retry()` 반환 |
| `WidgetPeriodicSyncWorker.kt` (신규) | `WidgetInitialSyncWorker`와 동일 로직(fetch-with-fallback), `PeriodicWorkRequestBuilder<>(1, TimeUnit.DAYS)`로 등록. `enqueueUniquePeriodicWork(..., ExistingPeriodicWorkPolicy.KEEP)`, 앱 최초 실행 시(`MainApplication.onCreate` 또는 `MainActivity.onCreate`) 1회 등록 |
| `MainActivity.kt` (현재 uncommitted 변경분) | `onCreate`의 `enqueueWidgetInitialSync` 유지. `onStart`의 `refreshWidgetsFromPrefs()`는 `WidgetUpdateNotifier`를 직접 호출하는 형태로 단순화(별도 함수 불필요해짐 — §9 참조) |
| `WidgetRefresh.kt` (현재 uncommitted 신규 파일) | `WidgetUpdateNotifierImpl`로 흡수, 별도 파일 제거 |

## 7. Error Handling

- **Firestore 조회 실패**(`Source.SERVER`가 진짜 예외를 던지는 경우): `Repository.save()`를 호출하는 Worker가 `Result.retry()` 반환 → WorkManager backoff(30초, 지수 증가)로 재시도. 무한 재시도는 WorkManager 기본 정책(약 5회 이후 유예)을 따름.
- **prefs도 없고 Firestore도 실패**: `WidgetContentState.NoDataYet`. 안내 문구 표시, 위젯 탭으로 앱 진입 가능(정상 클릭 동작 유지).
- **JSON decode 실패**(손상된 prefs): `WidgetContentState.Error`. `ErrorView`에 "새로고침" 안내 + 클릭 시 앱 열림. Crashlytics 기록(기존 `CrashlyticsHelper` 패턴 유지).
- **진짜 예상 못 한 Compose 크래시**: `onCompositionError()` 오버라이드 → Crashlytics 기록 + 기존 `errorUiLayout` 표시(최후 안전망, 클릭 인텐트 없는 한계는 남지만 도달 빈도가 극히 낮아지므로 허용).

## 8. Testing Strategy

기존 컨벤션(`BibleRepositoryTest.kt`의 `FakeBibleDb` 패턴, 순수 JUnit4, mocking 프레임워크 없음)을 따른다.

- `SermonPrefsDataSource`/`SermonFirestoreDataSource`를 인터페이스로 추출(`SermonPrefsSource`/`SermonRemoteSource` 등) — Fake 구현으로 교체 가능하게. QT도 동일.
- `SermonRepositoryImplTest`: `save()` 호출 시 (1) prefs 저장, (2) StateFlow가 새 값으로 emit, (3) `WidgetUpdateNotifier` 호출 순서를 Fake notifier로 검증.
- 신규 의존성: `kotlinx-coroutines-test`(Flow/코루틴 테스트용), `androidx.work:work-testing`(`WidgetInitialSyncWorker`가 실패 시 `Result.retry()`를 반환하는지 `TestWorkerBuilder`로 검증).
- 실기기/에뮬레이터 회귀 검증: 이번 세션에서 썼던 절차(uninstall → install → 위젯 추가(앱 미실행) → 위젯 탭으로 앱 실행 → adb logcat)를 그대로 재사용해 end-to-end 확인.

## 9. Rollout Plan

1. 현재 uncommitted 변경분(`MainActivity.kt`의 onCreate/onStart 추가, `WidgetRefresh.kt`, 디버그용 `Timber.d` 계측 4개 위젯 파일)은 이번 설계로 대체됨. 계측 로그는 새 구조 구현 후 제거하거나 핵심 지점(state transition 로그)만 남긴다.
2. 구현 순서(다음 `writing-plans` 단계에서 세분화): (1) `WidgetContentState` + Repository Flow화 → (2) `WidgetUpdateNotifier` 도입 + 기존 writer들 연결 → (3) `Source.SERVER` 전환 → (4) `WidgetInitialSyncWorker` 재시도 로직 수정 + `WidgetPeriodicSyncWorker` 신설 → (5) 위젯 4개 파일의 `provideGlance`/`provideContent`를 `collectAsState` 패턴으로 전환 + 에러 뷰 추가.
3. 각 단계마다 기존 회귀 시나리오(클린 설치 → 위젯 추가 → 앱 실행)로 검증 후 다음 단계 진행 권장.

## 10. File Change Checklist

- [ ] `android/app/src/main/java/app/mannadev/meditation/widget/state/WidgetContentState.kt` (신규)
- [ ] `android/app/src/main/java/app/mannadev/meditation/widget/WidgetUpdateNotifier.kt` (신규)
- [ ] `android/app/src/main/java/app/mannadev/meditation/domain/repository/SermonRepository.kt` (수정)
- [ ] `android/app/src/main/java/app/mannadev/meditation/data/SermonRepositoryImpl.kt` (수정)
- [ ] `android/app/src/main/java/app/mannadev/meditation/domain/repository/QtRepository.kt` (신규)
- [ ] `android/app/src/main/java/app/mannadev/meditation/data/QtRepositoryImpl.kt` (신규)
- [ ] `android/app/src/main/java/app/mannadev/meditation/domain/usecase/GetDisplaySermonUseCase.kt` / `GetDisplayQtUseCase.kt` / `SaveDisplaySermonUseCase.kt` / `SaveDisplayQtUseCase.kt` / `ClearWidgetPreferenceUseCase.kt` (제거)
- [ ] `android/app/src/main/java/app/mannadev/meditation/di/WidgetDependencies.kt` / `RNModuleDependencies.kt` (노출 타입을 UseCase → Repository로 교체)
- [ ] `android/app/src/main/java/app/mannadev/meditation/data/SermonFirestoreDataSource.kt` (Source.SERVER)
- [ ] `android/app/src/main/java/app/mannadev/meditation/data/QtFirestoreDataSource.kt` (Source.SERVER)
- [ ] `android/app/src/main/java/app/mannadev/meditation/ui/widget/VerseWidgetSmall.kt` / `VerseWidgetLarge.kt` / `QtWidgetSmall.kt` / `QtWidgetLarge.kt` (collectAsState 전환, 에러 뷰)
- [ ] `android/app/src/main/java/app/mannadev/meditation/rnmodule/WidgetUpdateModule.kt` (단순화)
- [ ] `android/app/src/main/java/app/mannadev/meditation/service/MyFirebaseMessagingService.kt` (단순화)
- [ ] `android/app/src/main/java/app/mannadev/meditation/widget/WidgetInitialSyncWorker.kt` (재시도 로직 수정)
- [ ] `android/app/src/main/java/app/mannadev/meditation/widget/WidgetPeriodicSyncWorker.kt` (신규)
- [ ] `android/app/src/main/java/app/mannadev/meditation/MainActivity.kt` (단순화)
- [ ] `android/app/src/main/java/app/mannadev/meditation/widget/WidgetRefresh.kt` (제거, `WidgetUpdateNotifier`로 흡수)
- [ ] `android/app/build.gradle.kts` (`kotlinx-coroutines-test`, `androidx.work:work-testing` 추가)
- [ ] 신규 테스트: `SermonRepositoryImplTest.kt`, `QtRepositoryImplTest.kt`, `WidgetInitialSyncWorkerTest.kt`
