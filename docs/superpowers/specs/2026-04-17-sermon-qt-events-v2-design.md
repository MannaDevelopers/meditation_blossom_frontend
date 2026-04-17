# Sermon & QT Events v2 — Phase 1 Design

- Date: 2026-04-17
- Scope: Android + React Native only. **iOS Swift 수정 없음.**
- Related: FCM v2 토픽 마이그레이션(`sermon_events` → `sermon_events_v2`), 신규 `qt_events` 도입, Android QT 위젯 추가, RN ↔ Android bridge 확장.

## 1. Goal

1. Sermon FCM 이벤트를 v1(`sermon_events`, 평문 `content`)에서 v2(`sermon_events_v2`, 구조화 `bible_references`)로 이행한다.
2. 신규 `qt_events` 토픽과 Firestore `qt` 컬렉션을 소비하는 QT 기능을 도입한다.
3. Android에서 `bible_references` 참조를 내장 `BibleDb`로 재조회하여 본문(`content`)을 재구성한다. payload의 `verses` 필드는 **의도적으로 무시**한다(로컬 DB를 SSoT로 사용).
4. QT 전용 Android 홈 위젯(Small / Large)을 Sermon 위젯과 평행하게 추가한다.
5. React Native에서 QT를 `DailyMannaScreen`(현재 플레이스홀더)에 렌더링한다.

## 2. Non-Goals

- iOS Swift 코드(Widget Extension, Notification Service, App Group writer) 수정
- EditScreen에서 QT 위젯 커스터마이징/미리보기 지원
- Alpha 환경(`alpha_sermon_events_v2`, `alpha_qt_events`) 구독 분기
- `source_id` / `raw_hash` 기반 이벤트 dedup
- QT 시스템 푸시 알림(visible notification). 데이터 메시지만 처리
- Phase 범위 외 사유: iOS 대응과 커스터마이징은 후속 이슈에서 처리

## 3. Key Decisions (확정됨)

| # | 주제 | 결정 | 근거 |
|---|------|------|------|
| 1 | `verses` 필드 | payload / Firestore에 존재하지만 **무시**. BibleDb에서 재조회 | 로컬 DB를 ground truth로 삼아 번역본·포맷 통제 확보 |
| 2 | iOS 동작 | 수정 없음. Firestore에서 `content` 빈 상태로 렌더되어도 허용 | 이번 Phase 범위 외 |
| 3 | QT UI 위치 | `DailyMannaScreen`의 "준비 중" 플레이스홀더를 교체 | 기존 탭 구조 유지, 최소 변경 |
| 4 | `resolveBibleReferencesJson` 출력 | 기존 `content` 포맷과 동일한 단일 평문 `"본문 : {참조들} {본문}"` | 기존 파서/위젯/AsyncStorage 직렬화 재사용, 변경 최소 |
| 5 | YouTube 타겟 URL | 문서의 `video_url` 필드 (Sermon / QT 각각) | 위젯·화면 공통 적용. 공유된 "YouTube 링크" 토글 하나로 on/off |
| 6 | v1 → v2 마이그레이션 | `MainApplication`에서 v1 unsubscribe + `MyFirebaseMessagingService`에서 v1 토픽 메시지 완전 drop(로그 없이) | unsubscribe 실패나 서버 병행 발행 기간에도 중복 처리 차단 |

## 4. Architecture

### 4.1 두 개의 평행 파이프라인

```
[FCM 서버]
  ├── sermon_events_v2 ──▶ MyFirebaseMessagingService (분기 sermon)
  │                         ├── bible_references → BibleReferenceResolver
  │                         │   → content 문자열
  │                         ├── SaveDisplaySermonUseCase → SharedPreference
  │                         ├── VerseWidgetLarge/Small updateAll
  │                         ├── AsyncStorage["fcm_sermon"] 저장
  │                         └── LocalBroadcast SERMON_UPDATE_EVENT
  │
  └── qt_events ──────────▶ MyFirebaseMessagingService (분기 qt)
                            ├── bible_references → BibleReferenceResolver
                            ├── SaveDisplayQtUseCase → SharedPreference
                            ├── VerseWidgetLargeQt/SmallQt updateAll
                            ├── AsyncStorage["fcm_qt"] 저장
                            └── LocalBroadcast QT_UPDATE_EVENT

[App 실행]
  HomeScreen      ─ useSermonData ─ Firestore `sermons` ─ (Android) bridge.resolveBibleReferences ─▶ content
                                                      └ (iOS) content: '' (허용)
  DailyMannaScreen ─ useQtData     ─ Firestore `qt`      ─ (동일 경로)
```

- `BibleReferenceResolver`는 sermon/qt 공용. v2 JSON 배열만 알면 소비자는 무관심.
- `MyFirebaseMessagingService` 단일 서비스에서 `topic` 분기. 공통 persist/broadcast 로직은 helper로 추출.
- RN bridge는 resolve 함수 하나(`resolveBibleReferences`)로 양쪽 재사용, QT 위젯 업데이트용 `onQtUpdated`만 별도.

### 4.2 에러 / 폴백 경로

| 경로 | 성공 | 실패 |
|------|------|------|
| FCM v2 (Android native) | resolved content 저장 | resolve 실패 → Crashlytics 기록, 이번 업데이트 skip (이전 위젯/AsyncStorage 유지) |
| Firestore 쿼리 (Android RN) | bridge로 resolve → 정상 렌더 | bridge 실패 → `content: ''`, UI 공란, 에러 로그 |
| Firestore 쿼리 (iOS RN) | `content: ''` 반환, 공란 렌더 | — |
| v1 FCM 메시지 | — | 서비스에서 silent drop (로그 없음) |

## 5. Android Native Layer

### 5.1 Constants

- `SERMON_SUBJECT`, `SERMON_SUBJECT_V2`, `QT_SUBJECT`, `ASYNC_STORAGE_FCM_SERMON`, `ASYNC_STORAGE_FCM_QT`, `ACTION_SERMON_UPDATE_EVENT` 는 기 존재.
- **추가 필요**: `ACTION_QT_UPDATE_EVENT`, `MESSAGE_QT_UPDATE_EVENT`.

### 5.2 `MainApplication.onCreate` (이미 반영 완료 상태)

- v1 `sermon_events` unsubscribe.
- v2 `sermon_events_v2`, `qt_events` subscribe.
- DEBUG 빌드에서 `sermon_events_test` unsubscribe, `sermon_events_v2_test` / `qt_events_test` subscribe.
- 실패 시 `CrashlyticsHelper.recordException`으로 기록. 앱 동작은 계속.

### 5.3 `BibleReferenceResolver.resolveBibleReferencesJson`

**입력**: `"[{\"book\":\"요나\",\"chapter\":3,\"verse_start\":1,\"verse_end\":10,\"verses\":[...]}, ...]"` (JSON 배열 문자열)

**출력**: `"본문 : 요나 3:1-10, 에베소서 5:15-16 1 여호와의 ... 15 그런즉 ..."` (기존 `content` 포맷과 동일)

**절차**:
1. `kotlinx.serialization`로 `List<BibleReferenceDto>` 파싱. DTO는 `book`, `chapter`, `verse_start`, `verse_end`만 사용하고 `verses` 필드는 `ignoreUnknownKeys`로 무시.
2. 각 참조마다 `repo.getRange(book, chapter, verse_start, verse_end)` 로 `VerseRow` 조회.
3. `reference` 문자열: 참조들을 `", "`로 조인 (예: `"요나 3:1-10, 에베소서 5:15-16"`).
4. `body` 문자열: 모든 `VerseRow`를 `"${verse} ${text}"` 형태로 공백 조인. 단 Row가 하나면 본문 텍스트만.
5. `"본문 : ${reference} ${body}"` 반환.

**에러 정책**: 파싱/DB 조회 실패 시 `VerseParseException` 계열 throw. 호출자는 Crashlytics에 기록 후 이번 업데이트만 skip.

### 5.4 `MyFirebaseMessagingService` 리팩터

- `shouldProcess`를 **strict 매칭**으로 변경: `from` 또는 `data.topic`이 `sermon_events_v2` / `qt_events` (+ DEBUG에서 `_test` 변종) 일 때만 true. 그 외(v1 포함)는 silent drop(로그 없음).
- `onMessageReceived`에서 허용된 토픽 확인 후 sermon / qt 경로로 분기.
- 공통 로직은 `private suspend fun persistAndBroadcast(...)` helper로 추출: DB 저장 → 위젯 updateAll → AsyncStorage → LocalBroadcast.
- **Sermon 경로**: `messageToSermon` 을 v2 스키마 기반으로 교체. `content` 키 대신 `bible_references` 키를 읽어 `resolveBibleReferencesJson` 으로 content 생성 후 `SermonDto` 조립.
- **QT 경로**: `messageToQt` 신설. `QtDto` 조립, `SaveDisplayQtUseCase` 호출, `VerseWidgetLargeQt/SmallQt.updateAll`, `AsyncStorage[ASYNC_STORAGE_FCM_QT]` 저장, `ACTION_QT_UPDATE_EVENT` 브로드캐스트.

### 5.5 QT 도메인 (신규)

- `dto/QtDto.kt` — `sourceId`, `title`, `seriesTitle`, `date`, `dayOfWeek`, `content`(resolved), `videoUrl?`.
- `domain/usecase/{SaveDisplayQtUseCase, GetDisplayQtUseCase, ClearQtPreferenceUseCase}.kt` — `*Sermon*` usecase 패턴 복제. SharedPreference 키만 분리(`qt_display` 등).
- `domain/repository/QtRepository.kt` + impl — 동일 패턴.
- Hilt 모듈에서 바인딩 추가. `getRNModuleDependencies`에 `getSaveDisplayQtUseCase()`, `getClearQtPreferences()` 노출.

### 5.6 QT 위젯

- `ui/widget/VerseWidgetLargeQt.kt`, `VerseWidgetSmallQt.kt` — `VerseWidgetLarge/Small` 복제. 텍스트 필드만 조정:
  - "설교 날짜" → "QT 날짜"
  - `series_title` 추가 렌더 라인
  - `title`, `content`는 동일 패턴
  - 탭 → `actionStartActivity<MainActivity>()` (기존 Sermon 위젯과 동일)
- `widget/QtWidgetLargeReceiver.kt`, `QtWidgetSmallReceiver.kt` — `GlanceAppWidgetReceiver` 구현, 대응되는 `VerseWidgetLargeQt/SmallQt` 를 `glanceAppWidget`에 반환.
- `AndroidManifest.xml` — 신규 receiver 2개 선언, `APPWIDGET_UPDATE` 인텐트 필터, `meta-data`로 `app_widget_qt_{large,small}_info.xml` 참조.
- `res/xml/app_widget_qt_{large,small}_info.xml` — 기존 sermon widget info 복제 후 preview / 최소 크기 / 설명 텍스트 조정.

### 5.7 RN 브릿지 (`WidgetUpdateModule.kt`)

추가 `@ReactMethod` 2개:

- `resolveBibleReferences(jsonString: String, promise: Promise)` — `bibleReferenceResolver.resolveBibleReferencesJson(jsonString)` 호출, resolved string resolve. 예외는 Crashlytics 기록 후 reject.
- `onQtUpdated(qtData: String, promise: Promise)` — `onSermonUpdated` 와 평행 구조. `QtDto` 디코딩 → 이미 resolved된 content 가정(RN 쪽에서 resolve 후 전달) → `SaveDisplayQtUseCase` → QT 위젯 `updateAll`.

기존 `setYoutubeLinkEnabled` / `getYoutubeLinkEnabled` 는 Sermon · QT 공용으로 변경 없이 재사용.

## 6. React Native Layer

### 6.1 Types

**`src/types/Sermon.ts` 변경**

- `Sermon` 인터페이스: `video_url?: string` 추가. `content: string` 유지.
- `SermonRaw`: v2 payload 반영 — `bible_references?: string`(JSON 문자열), `content?: string`(하위 호환), `source_id?: string`, `video_url?: string` 추가.
- `firestoreDocToSermon` 시그니처 변경: `async (doc) => Promise<Sermon>`. 내부에서 `Platform.OS === 'android'`일 때 `WidgetUpdateModule.resolveBibleReferences(doc.data().bible_references)` 호출. iOS는 `content: ''` 반환.
- `fcmDataToSermon`은 변경 없음 (Android native가 AsyncStorage에 저장할 때 이미 resolved content 포함).

**`src/types/QT.ts` (신규)**

```ts
export interface QT {
  id: string;
  title: string;
  series_title: string;
  content: string;              // resolved
  date: string;
  day_of_week?: string;
  video_url?: string;
  created_at: FirestoreTimestamp;
  updated_at: FirestoreTimestamp;
}
export interface QTRaw { /* FCM 원본: bible_references 포함 */ }
export const FCM_QT_KEY = 'fcm_qt';
export function fcmDataToQt(raw: QTRaw): QT { /* Sermon 패턴 복제 */ }
export async function firestoreDocToQt(doc): Promise<QT> { /* bridge 호출 */ }
export function compareQt(a, b): number { /* date + updated_at */ }
```

**`src/types/WidgetUpdateModule.ts` 변경**

```ts
interface WidgetUpdateModuleInterface {
  onSermonUpdated(sermonData: string): Promise<boolean>;
  onQtUpdated(qtData: string): Promise<boolean>;              // 신규
  resolveBibleReferences(jsonString: string): Promise<string>; // 신규
  onClear(): Promise<void>;
  getAppGroupData(key: string): Promise<string | null>;
  setYoutubeLinkEnabled(enabled: boolean): Promise<void>;
  getYoutubeLinkEnabled(): Promise<boolean>;
}
```

### 6.2 Services

**`src/services/sermonService.ts`**

- `firestoreDocToSermon` 이 async 가 됨에 따라 `fetchLatestSermonFromCache` / `fetchLatestSermonFromServer` 호출부에 `await` 추가.
- bridge 호출 실패 시 `logger.error` + `content: ''` 반환으로 graceful degrade.

**`src/services/qtService.ts` (신규)**

- `fetchLatestQtFromCache / FromServer / FromAsyncStorage` — `sermonService` API 형태 동일, 컬렉션만 `qt`, 키만 `fcm_qt`.
- `isQtDataStale(date, thresholdDays)` — 동일 로직 재사용(임계값 상수 공유).
- App Group 관련 함수 없음 (iOS 전용 기능, QT는 Android 전용).

### 6.3 Hooks

- **`src/hooks/useQtData.ts`** (신규): `useSermonData` 평행. `{qt, isLoading, error, loadLocalData, fetchFromServer, onRefresh}` 반환. iOS App Group 동기화 경로 없음.
- **`src/hooks/useQtWidgetSync.ts`** (신규): `useWidgetSync` 패턴. `WidgetUpdateModule.onQtUpdated` 호출. 타입 분리를 위해 별도 훅.
- **`src/hooks/useQtFCMListener.ts`** (신규): `useFCMListener` 패턴. `ACTION_QT_UPDATE_EVENT` 브로드캐스트 수신 시 QT 재로드.

### 6.4 Screens

**`src/screens/DailyMannaScreen.tsx` 재작성**

- 현재 "준비 중" 플레이스홀더를 QT 렌더로 교체.
- 구조: HomeScreen 미러링.
  - Header: 아이콘 + "묵상만개" + Youtube 버튼 + Settings 버튼
  - ScrollView:
    - `dateText` (qt.date)
    - `seriesTitleText` (qt.series_title) — 신규 스타일
    - `titleText` (qt.title)
    - `indexText + contentText` (`extractContent(qt.content)` 재사용)
    - Youtube 링크 컨테이너 (`qt.video_url`로 이동, 없으면 채널 URL 폴백)
- `useQtData` + `useQtWidgetSync` + `useQtFCMListener` + mount `init()` 패턴.
- `isLoading` / `error` 분기 + Retry 버튼.
- `youtubeLinkEnabled` off 면 Youtube 요소 비표시.

**`src/screens/HomeScreen.tsx` 수정**

- YouTube 타겟을 `SUNDAY_SERMON_YOUTUBE_URL` 하드코딩 → `sermon?.video_url ?? 채널URL`.
- `youtubeLinkEnabled` 상태를 반영해 비표시 가능하도록 조정.

### 6.5 Navigation

- 가정: `MainTabs`에 이미 `HomeScreen` / `DailyMannaScreen` 이 탭으로 연결되어 있음. 실제 확인은 writing-plans 단계에서 App.tsx / MainTabs 구성 파일을 읽고 조정.
- 만약 미연결이면 탭 등록 작업을 플랜에 추가.

## 7. Testing Strategy

### 7.1 Android Unit Tests

`BibleReferenceResolverTest`(신규 혹은 확장):

- v2 JSON 배열 단일 참조 → 예상 `"본문 : ref body"` 일치.
- v2 JSON 다중 참조 → 참조 콤마 조인, 본문 공백 조인.
- `verses` 필드가 payload에 있어도 **무시되고 BibleDb 결과가 사용**됨 (핵심 불변성).
- 빈 JSON `[]` / malformed JSON → 예외.
- 존재하지 않는 `book` → `BibleRepository` 예외 전파.

`MyFirebaseMessagingService` 통합 로직은 수동 검증으로 커버.

### 7.2 RN Unit Tests (`__tests__/`)

- `Sermon.test.ts` 확장: `firestoreDocToSermon` async 정상 경로 / bridge 에러 / iOS 경로 (Platform mock) 검증.
- `QT.test.ts` 신규: `fcmDataToQt`, `firestoreDocToQt`, `compareQt`.
- `qtService.test.ts` 신규: `isQtDataStale`, AsyncStorage / Firestore 소스 선택.

`jest.setup.js` 에 `WidgetUpdateModule` mock 확장 — `resolveBibleReferences`, `onQtUpdated` 기본 구현 추가.

### 7.3 Manual Verification

| # | 시나리오 | 확인 |
|---|---------|------|
| 1 | `sermon_events_v2` 수신 | Logcat `Parsed sermon` → 위젯 갱신 → HomeScreen 반영 |
| 2 | `qt_events` 수신 | Logcat `Parsed qt` → QT 위젯 갱신 → DailyMannaScreen 반영 |
| 3 | 기존 사용자 앱 업데이트 시뮬레이션 | 첫 실행 시 `sermon_events` unsubscribe 성공 Logcat 확인 |
| 4 | v1 메시지 주입 (디버그 툴로 `sermon_events` 토픽 발행) | 서비스 진입조차 하지 않음(무반응). Crashlytics 기록 없어야 함 |
| 5 | 앱 cold start → Firestore → Android bridge 경로 | Home / DailyManna 모두 본문 정상 렌더 |
| 6 | iOS cold start | 본문 공란(또는 이전 캐시) 상태. **크래시 없이** 화면 진입 |
| 7 | QT 위젯 추가 / 제거 | 시스템 위젯 피커에 노출, 추가 시 초기 더미 → 실제 데이터 교체 |
| 8 | YouTube 링크 토글 off → on | Sermon · QT 양쪽 화면/위젯 동작 반영 |
| 9 | 존재하지 않는 book 참조 | 해당 업데이트 skip, 이전 위젯 상태 유지, Crashlytics 기록 |

### 7.4 Regression Gate

- `npx jest` 전체 green.
- `yarn lint` no errors.
- Android Gradle 테스트 task green.

## 8. Rollout Plan

1. **이 Phase 1 클라이언트 출시 이전에 서버가 `sermon_events_v2` / `qt_events` 토픽 발행을 시작해야 함.** 그렇지 않으면 신규 토픽 구독 후 이벤트 미수신 dead period 발생.
2. 클라이언트는 v1 을 unsubscribe + silent drop 하므로 서버가 v1 을 당장 끊지 않아도 안전. **서버 v1 중단은 클라이언트 버전 이행률 확인 후 별도 타이밍**.
3. iOS 빌드가 동일 릴리스에 포함되면 iOS 유저는 본문 공란 경험. **스토어 릴리스 노트 / 내부 공지에 "이번 버전 iOS 미지원, 기존 v1 유지 권장"** 명시.

## 9. Risks

| 리스크 | 영향 | 완화 |
|--------|------|------|
| v1 unsubscribe 실패 (Firebase 일시 장애) | 다음 실행까지 v1 구독 유지 | Strict topic filter가 처리 자체 차단. 체감 무 |
| BibleDb 매칭 실패 (신규 book 등) | 해당 업데이트 skip | Crashlytics 기록, 이전 상태 유지. Silent skip |
| RN bridge async 전환 race | `firestoreDocToSermon` Promise 로 바뀜 → `await` 누락 시 빈 content 렌더 | TS 컴파일러 + 호출부 grep + 유닛 테스트 |
| iOS 유저 부정적 피드백 | 본문 공란 | 릴리스 노트 명시, 다음 Phase에서 대응 예고 |
| Payload 크기 초과 | 서버 측 책임 | 4KB 우회용으로 v2 별도 토픽 사용 (문서화됨) |

## 10. File Change Checklist

### Android (`android/app/src/main/`)

- [x] `Constants.kt` — v2/qt 토픽 상수 (기 반영). `ACTION_QT_UPDATE_EVENT`, `MESSAGE_QT_UPDATE_EVENT` 추가 필요.
- [x] `MainApplication.kt` — v1 unsubscribe + v2/qt subscribe (기 반영).
- [ ] `model/BibleReferenceResolver.kt` — `resolveBibleReferencesJson` 실제 구현.
- [ ] `service/MyFirebaseMessagingService.kt` — strict filter + v2 schema + qt 분기.
- [ ] `dto/QtDto.kt` (신규).
- [ ] `domain/usecase/{SaveDisplayQtUseCase, GetDisplayQtUseCase, ClearQtPreferenceUseCase}.kt` (신규).
- [ ] `domain/repository/QtRepository.kt` + impl (신규).
- [ ] `ui/widget/{VerseWidgetLargeQt, VerseWidgetSmallQt}.kt` (신규).
- [ ] `widget/{QtWidgetLargeReceiver, QtWidgetSmallReceiver}.kt` (신규).
- [ ] `rnmodule/WidgetUpdateModule.kt` — `resolveBibleReferences`, `onQtUpdated` 메서드 추가.
- [ ] `di/` — QT usecase/repo Hilt 바인딩.
- [ ] `AndroidManifest.xml` — QT receiver 2개 선언.
- [ ] `res/xml/app_widget_qt_{large,small}_info.xml` (신규).
- [ ] (선택) widget preview drawable / 스트링 리소스.

### React Native (`src/`)

- [ ] `types/Sermon.ts` — `video_url?` 추가, `firestoreDocToSermon` async 전환.
- [ ] `types/QT.ts` (신규).
- [ ] `types/WidgetUpdateModule.ts` — `resolveBibleReferences`, `onQtUpdated` 추가.
- [ ] `services/sermonService.ts` — await 반영, bridge 경로.
- [ ] `services/qtService.ts` (신규).
- [ ] `hooks/useQtData.ts` (신규).
- [ ] `hooks/useQtWidgetSync.ts` (신규).
- [ ] `hooks/useQtFCMListener.ts` (신규).
- [ ] `screens/DailyMannaScreen.tsx` — 플레이스홀더 교체.
- [ ] `screens/HomeScreen.tsx` — YouTube URL `video_url` 로 변경, 토글 반영.
- [ ] `jest.setup.js` — `WidgetUpdateModule` mock 확장.
- [ ] `__tests__/QT.test.ts`, `__tests__/qtService.test.ts`, `__tests__/Sermon.test.ts` 확장.

### Docs

- [x] 본 문서: `docs/superpowers/specs/2026-04-17-sermon-qt-events-v2-design.md`.
