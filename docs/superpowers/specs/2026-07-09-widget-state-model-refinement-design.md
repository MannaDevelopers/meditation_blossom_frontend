# 위젯 State 모델 재정의 — Design

- Date: 2026-07-09
- Related: `2026-07-09-android-widget-sync-architecture-design.md`(원 설계), `2026-07-09-android-widget-sync-architecture.md`(Task 1~14 구현 완료)
- Scope: **Android only.** iOS(WidgetKit/App Group), RN JS 쪽 fetch 로직은 변경하지 않는다.

## 1. Goal

1. 위젯이 "안내 문구"(아직 활성화 전) vs "에러 문구"(진짜 동기화 실패)를 보여주는 기준을, 사용자가 앱을 켜본 적 있는지가 아니라 **실제로 최근 동기화가 성공했는지 실패했는지**로 바꾼다.
2. `syncFromRemote()`의 실패가 지금은 Worker의 재시도 판단에만 쓰이고 위젯이 구독하는 state에는 전혀 반영되지 않는 gap을 없앤다 — 반복 실패해도 위젯이 그 사실을 전혀 모르는 상태를 고친다.
3. `MainActivity`에 남아있는, 이제는 근거가 약해진 호출들(`enqueueWidgetInitialSync()`, `onStart()`의 수동 `WidgetUpdateNotifier` 호출, `markAppLaunched()`)을 정리해서 `MainActivity`를 오버라이드 없는 순수 `ReactActivity`로 되돌린다.

## 2. Non-Goals

- iOS WidgetKit/App Group 변경
- RN JS 쪽 fetch 로직 변경(`useSermonData`, `HomeScreen.init()` 등) — 이 로직이 이미 안정적으로 동작함을 근거로 삼지만, 로직 자체는 건드리지 않는다
- `WidgetUpdateModule`의 JS 인터페이스 시그니처 변경
- `SermonRepositoryImpl`/`QtRepositoryImpl`의 `init { loadFromPrefs() }` 블록 자체의 동작 변경(2026-07-09 원 설계 Task 4 리뷰에서 이미 검토·수용된 레이스 컨디션은 이번 스펙 범위 밖)
- Firestore 재시도 정책(`Result.retry()` + `BackoffPolicy.EXPONENTIAL`) 변경 — 그대로 유지

## 3. 배경 — 왜 지금 구조가 잘못됐나

`WidgetContentState.NoDataYet(hasAppEverLaunched: Boolean)`은 "데이터가 없을 때 어떤 문구를 보여줄지"를 `AppLaunchState.hasEverLaunched()`(= 사용자가 메인 앱을 한 번이라도 실행한 적 있는지)로 판단한다. 이 신호는 실제 동기화 성공/실패와 무관하다:

- `syncFromRemote()`가 반복 실패해도 `_sermonState`/`_qtState`는 전혀 갱신되지 않는다. 실패는 그대로 `runWidgetSync()`를 거쳐 Worker의 `Result.retry()`로만 전달되고, 위젯이 구독하는 state로는 흘러가지 않는다.
- 따라서 "앱을 이미 여러 번 써본 사용자인데 동기화가 계속 실패 중"인 경우도, "앱을 한 번도 안 켠 사용자"인 경우도 `hasAppEverLaunched` 값이 우연히 같으면 똑같은 문구가 뜬다 — 실제 원인과 무관한 결과.
- `hasAppEverLaunched`는 한 번 `true`가 되면 영원히 `true`로 남는 단조 플래그라, "지금 이 순간 데이터가 없는 이유"를 설명하는 근거로는 애초에 부적합하다.

## 4. Key Decisions

| # | 주제 | 결정 | 근거 |
|---|------|------|------|
| 1 | `NoDataYet`의 의미 | `hasAppEverLaunched: Boolean` 파라미터 제거. `data object NoDataYet`으로 단순화 — "지금까지 한 번도 성공적으로 동기화된 적 없음"만 의미 | 실제 동기화 결과와 무관한 신호를 제거 |
| 2 | 동기화 실패의 가시성 | `syncFromRemote()`가 fetch 예외를 rethrow하기 전에 `_sermonState`/`_qtState`를 `WidgetContentState.Error(e)`로 먼저 세팅한다 | 지금은 실패가 Worker에만 보이고 위젯 state엔 전혀 안 보임 — 이미 존재하는 `Error` state를 재활용해서 새 타입 추가 없이 해결 |
| 3 | 성공+빈 컬렉션 처리 | `syncFromRemote()`가 성공했지만 `fetched == null`(Firestore에 문서가 진짜 없음)이면 `NoDataYet`으로 세팅 | 지금은 이 경우 아무 반응이 없어서, 직전 state가 `Error`였다면 실제로는 재시도가 성공해서 "진짜 데이터가 없을 뿐"인데도 `Error` 문구가 계속 남는 별도 버그가 있었음 — 같이 고침 |
| 4 | 실패 시 위젯 즉시 갱신 여부 | `syncFromRemote()`가 `Error`/`NoDataYet`으로 state를 바꿀 때 `WidgetUpdateNotifier`도 함께 호출한다 | 이미 열려있는 세션에만 조용히 반영되게 두면, 백그라운드 sync가 계속 실패해도 사용자는 위젯이 멈춰있다는 걸 알 방법이 없다. 실패를 능동적으로 보여주는 쪽이 지금보다 낫다 |
| 5 | 실패 상태 영속화 여부 | SharedPreferences 등에 저장하지 않는다. 프로세스 생존 동안만 메모리 `StateFlow`로 들고 있다가, 다음 실제 `syncFromRemote()` 호출에서 다시 판단한다 | 영속화하면 오래된 실패 기록이 남아 다음 프로세스 시작 시 그릇된 `Error` 표시로 이어질 수 있음. 매 호출마다 "지금" 판단하는 게 더 정확하고, 별도 SharedPreferences 키/직렬화 코드가 필요 없어 단순함 |
| 6 | `AppLaunchState` 제거 | `AppLaunchState.kt` 파일 전체(top-level `markAppLaunched`/`hasAppEverLaunched` 함수 + interface + Hilt 구현체), `AppModule.kt`의 `bindAppLaunchState` `@Binds`, `Sermon`/`QtRepository`/`SermonRepository`의 `appLaunchState` 의존성을 모두 제거한다 | Decision 1로 인해 이 신호를 쓰는 곳이 없어짐 — 죽은 코드 |
| 7 | `MainActivity` 단순화 | `onCreate()`의 `enqueueWidgetInitialSync(this)`와 `markAppLaunched(this)`, `onStart()` 오버라이드 전체를 제거. `MainActivity`는 `getMainComponentName()`/`createReactActivityDelegate()`만 남은 순수 `ReactActivity`로 되돌아간다 | `enqueueWidgetInitialSync()`가 방어하려던 시나리오(앱 미실행 상태에서 위젯 설치 시 네이티브 fetch가 백그라운드 제약으로 실패)는 이미 두 경로로 커버됨: JS 쪽 `HomeScreen.init()`의 `fetchFromServer()`가 앱을 열 때마다 독립적으로 재시도하고(실측 신뢰성 확인됨), `WidgetInitialSyncWorker`가 `Result.retry()` + `BackoffPolicy.EXPONENTIAL`로 앱을 열지 않아도 자체적으로 재시도한다. `onStart()`의 수동 notify도 `save()`/`clear()`/`syncFromRemote()`가 이제 모든 실제 상태 변화에서 notify하므로 근거가 사라짐(잔여 리스크: `WidgetUpdateNotifier`의 `updateAll()`이 `runCatching`에 조용히 실패하면 다음 실제 상태 변화 전까지 재시도 기회가 없음 — 감수하기로 함) |
| 8 | 죽은 import 정리 | `QtWidgetSmall.kt`/`QtWidgetLarge.kt`의 `import app.mannadev.meditation.data.hasAppEverLaunched`(Task 11/12에서 `provideGlance()`가 교체되면서 이미 안 쓰이게 됐는데 못 지운 것) | 별개로 발견된 죽은 코드, 이번 정리에 포함 |

## 5. Data Model

```kotlin
// android/app/src/main/java/app/mannadev/meditation/widget/state/WidgetContentState.kt
sealed interface WidgetContentState<out T> {
    data object Loading : WidgetContentState<Nothing>
    data class Data<T>(val value: T) : WidgetContentState<T>
    data object NoDataYet : WidgetContentState<Nothing>          // 파라미터 제거
    data class Error(val throwable: Throwable) : WidgetContentState<Nothing>
}
```

### State 전이표

| 트리거 | 결과 | notify 호출 |
|---|---|---|
| `loadFromPrefs()`(Repository `init`) — prefs에 값 있음 | `Data` | 아니오(변화 없음) |
| `loadFromPrefs()` — prefs 비어있음 | `NoDataYet` | 아니오(변화 없음) |
| `loadFromPrefs()` — prefs decode 예외 | `Error(e)` | 아니오(변화 없음) |
| `save(dto)` | `Data` | 예(변화 없음) |
| `clear()` | `NoDataYet` | 예(변화 없음) |
| `syncFromRemote()` — fetch 성공 + 데이터 있음 | `save()` 위임 → `Data` | 예(변화 없음, `save()` 경유) |
| `syncFromRemote()` — fetch 성공 + `null`(진짜 빈 컬렉션) | `NoDataYet` | **예(신규)** |
| `syncFromRemote()` — fetch 예외 | `Error(e)`, 그 후 rethrow | **예(신규)** |

`loadFromPrefs()` 3개 분기는 notify하지 않는 기존 동작을 그대로 유지한다(Non-Goals 참고).

### UI 매핑

```kotlin
// Sermon.kt
val noData: Sermon = Sermon(
    verses = listOf(Constants.WIDGET_FIRST_LAUNCH_GUIDE_MESSAGE),
    title = Constants.WIDGET_FIRST_LAUNCH_TITLE,
    bookName = "",
)
val errorSermon: Sermon = /* 기존과 동일 */

// WidgetContentStateMapping.kt
fun WidgetContentState<Sermon>.toDisplaySermon(): Sermon = when (this) {
    is WidgetContentState.Data -> value
    is WidgetContentState.Loading, is WidgetContentState.NoDataYet -> Sermon.noData
    is WidgetContentState.Error -> Sermon.errorSermon
}
```

QT 쪽도 동일한 패턴: `QtWidgetUiModel.error(hasAppEverLaunched: Boolean)` 하나가 하던 일을 `QtWidgetUiModel.noData`(최초 안내)와 `QtWidgetUiModel.error`(새로고침 유도, 파라미터 없음) 두 개의 `val`로 분리한다.

## 6. Component Changes

| 파일 | 변경 |
|---|---|
| `widget/state/WidgetContentState.kt` | `NoDataYet`에서 `hasAppEverLaunched` 파라미터 제거 |
| `data/SermonRepositoryImpl.kt` | 생성자에서 `appLaunchState` 제거. `syncFromRemote()`가 fetch 예외 시 `Error` 세팅+notify 후 rethrow, `null` 응답 시 `NoDataYet` 세팅+notify하도록 재작성 |
| `data/QtRepositoryImpl.kt` | 위와 동일한 변경(QT 버전) |
| `domain/repository/SermonRepository.kt` / `QtRepository.kt` | 인터페이스 시그니처 변경 없음(내부 구현만 변경) |
| `model/Sermon.kt` | `fun noData(hasAppEverLaunched: Boolean)` → `val noData`(파라미터 없음) |
| `ui/widget/qt/QtWidgetUiModel.kt` | `fun error(hasAppEverLaunched: Boolean)` → `val noData` + `val error`(둘 다 파라미터 없음) |
| `ui/widget/WidgetContentStateMapping.kt` | `toDisplaySermon()`/`toDisplayQtUiModel()`에서 `hasAppEverLaunched` 분기 제거, `Loading`/`NoDataYet`을 같은 브랜치로 병합 |
| `ui/widget/QtWidgetSmall.kt` / `QtWidgetLarge.kt` | 죽은 `hasAppEverLaunched` import 제거 |
| `data/AppLaunchState.kt` | **파일 전체 삭제** |
| `di/AppModule.kt` | `bindAppLaunchState` `@Binds` 및 관련 import 제거 |
| `MainActivity.kt` | `onCreate()`에서 `enqueueWidgetInitialSync(this)`/`markAppLaunched(this)` 제거, `onStart()` 오버라이드 전체 제거. `getMainComponentName()`/`createReactActivityDelegate()`만 남김 |

### 영향받지 않는 것

- `WidgetInitialSyncWorker`/`WidgetPeriodicSyncWorker`의 `runWidgetSync()`/`Result.retry()` 로직 — `syncFromRemote()`가 여전히 예외를 rethrow하므로 Worker 쪽 재시도 판단은 그대로 동작
- `enqueueWidgetInitialSync()` 함수 자체와 4개 위젯 Receiver의 `onEnabled()` 호출부 — 위젯 최초 설치 시의 트리거로 계속 필요
- `WidgetUpdateModule`의 JS 인터페이스, FCM 서비스의 `save()` 호출 경로

## 7. 알려진 한계

프로세스가 막 재시작된 직후, prefs가 비어있으면 `loadFromPrefs()`가 일단 `NoDataYet`(최초 안내 문구)으로 시작한다 — 실제로는 이 사용자가 오래 써온 사람인데 최근 동기화가 계속 실패 중이었어도 마찬가지다. 하지만 다음 `syncFromRemote()` 시도(초기 설치 Worker 또는 1일 1회 periodic Worker, 또는 JS 쪽 fetch 성공 시의 `save()`)가 돌면 곧바로 정확한 state로 정정된다. 지금처럼 `hasAppEverLaunched`가 한 번 `true`가 되면 영원히 잘못된 문구가 나올 수 있는 것보다는, 훨씬 짧고 자기 교정되는 창이라 감수한다.

## 8. Testing Strategy

- `SermonRepositoryImplTest.kt`/`QtRepositoryImplTest.kt`: `FakeAppLaunchState` 및 생성자의 `appLaunchState` 파라미터 제거. 신규 케이스 추가 — `syncFromRemote()` 예외 시 `Error` 세팅+notify 확인, `syncFromRemote()`가 `null` 반환 시 `NoDataYet` 세팅+notify 확인.
- `SermonTest.kt`/`QtWidgetUiModelTest.kt`: 파라미터 없는 새 시그니처(`Sermon.noData`, `QtWidgetUiModel.noData`/`.error`)로 갱신.
- mocking 프레임워크 신규 도입 없음 — 기존 수동 Fake 패턴 유지.

## 9. File Change Checklist

- [ ] `widget/state/WidgetContentState.kt` — `NoDataYet` 파라미터 제거
- [ ] `data/SermonRepositoryImpl.kt` — `syncFromRemote()` 재작성, `appLaunchState` 제거
- [ ] `data/QtRepositoryImpl.kt` — 동일
- [ ] `model/Sermon.kt` — `noData` val로 변경
- [ ] `ui/widget/qt/QtWidgetUiModel.kt` — `noData`/`error` val로 분리
- [ ] `ui/widget/WidgetContentStateMapping.kt` — 매핑 단순화
- [ ] `ui/widget/QtWidgetSmall.kt` / `QtWidgetLarge.kt` — 죽은 import 제거
- [ ] `data/AppLaunchState.kt` — 삭제
- [ ] `di/AppModule.kt` — `bindAppLaunchState` 제거
- [ ] `MainActivity.kt` — `onCreate()`/`onStart()` 단순화
- [ ] `data/test/.../SermonRepositoryImplTest.kt` — Fake 제거, 신규 케이스 추가
- [ ] `data/test/.../QtRepositoryImplTest.kt` — 동일
- [ ] `model/test/.../SermonTest.kt` — 새 시그니처 반영
- [ ] `ui/widget/qt/test/.../QtWidgetUiModelTest.kt` — 새 시그니처 반영
