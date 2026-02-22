# CLAUDE.md

묵상만개 (Meditation Blossom) — React Native (bare, not Expo) 모바일 앱. 매주 교회 설교 콘텐츠를 홈 화면 위젯에 표시. Firebase Firestore에서 데이터를 가져오고 FCM으로 푸시.

## Commands

```bash
yarn install                 # 의존성 설치
yarn test                    # 전체 테스트 실행
npx jest __tests__/Foo.test.ts  # 단일 테스트 실행
yarn lint                    # ESLint
npx react-native run-ios     # iOS 실행 (사전: cd ios && pod install && cd ..)
npx react-native run-android # Android 실행
npx react-native start       # Metro 번들러
```

릴리스: `git tag v1.0.0 && git push origin v1.0.0` → GitHub Actions 자동 빌드. 로컬 빌드 시 `android/app/release.keystore`, `android/app/secrets.properties` 필요 (git 미포함).

## Rules

### Must

- **로깅**: `console.log/error/warn` 직접 호출 금지 → `src/utils/logger.ts` 사용. logger는 `__DEV__`에서만 콘솔 출력, 프로덕션에서 `warn`/`error`는 Crashlytics에 전송
- **에러 처리**: catch 블록에서 에러를 무시하지 않기. Crashlytics에 기록 (`logger.error`) 또는 상위로 전파
- **타입**: `any` 사용 금지. FCM 데이터는 `SermonRaw`, Firestore 쿼리는 `FirebaseFirestoreTypes.Query` 사용
- **스타일**: `StyleSheet.create` 사용 (EditScreen만 `styled-components/native` 예외). 인라인 스타일 지양
- **테스트**: 순수 함수 변경 시 `__tests__/` 에 단위 테스트 추가/수정. Jest preset은 `react-native`
- **커밋 메시지**: `[ISSUE-숫자] type: 설명` (예: `[ISSUE-45] fix: 버그 설명`)
- **PR 제목**: `[ISSUE-숫자] 설명` 또는 `[HOTFIX] 설명` (CI 검증)

### Must Not

- `console.log` / `console.error` 직접 사용 (→ `logger` 사용)
- Sermon 타입을 각 파일에서 재정의 (→ `src/types/Sermon.ts`의 정식 타입 사용)
- iOS App Group ID 하드코딩 (→ 각 Swift 파일의 `Constants.appGroupId` 사용)
- native module 이름 불일치 (Android `NativeEventModule.getName()` → JS에서 `NativeModules.MyEventModule`으로 접근)

## Architecture

### Data Flow

```
Firestore ──→ FCM push ──→ App receives
                            ├── AsyncStorage 저장 (key: "fcm_sermon")
                            ├── Native Widget 업데이트
                            └── (iOS) App Group에 기록 → Widget Extension에서 읽기
App launch ──→ Firestore cache + AsyncStorage ──→ compareSermon() 최신 선택 ──→ 화면 + 위젯
```

### src/ 구조

```
src/
├── App.tsx                    # Root (React Navigation native stack)
├── screens/
│   ├── HomeScreen.tsx         # 메인. 훅으로 데이터/동기화 위임
│   ├── EditScreen.tsx         # 위젯 커스터마이징 (styled-components)
│   ├── SettingsScreen.tsx     # 설정 + 숨김 개발자 메뉴 (5탭 토글)
│   └── TempSermonScreen.tsx   # 디버그용 설교 목록
├── hooks/
│   ├── useSermonData.ts       # 설교 로딩/상태 관리
│   ├── useAppGroupSync.ts     # iOS App Group 폴링/동기화
│   ├── useWidgetSync.ts       # Native 위젯 업데이트
│   └── useFCMListener.ts      # Android FCM 브로드캐스트 수신
├── services/
│   └── sermonService.ts       # 데이터 접근 계층 (Firestore, AsyncStorage, App Group)
├── types/
│   ├── Sermon.ts              # 핵심 타입 + 변환 함수 (fcmDataToSermon, firestoreDocToSermon, compareSermon)
│   ├── WidgetUpdateModule.ts  # Native bridge 인터페이스
│   └── navigation.ts          # RootStackParamList
├── components/
│   ├── WidgetPreview.tsx      # 설교 텍스트 파싱 + 미리보기 렌더링
│   └── SvgIcon.tsx            # SVG 아이콘 (assets/icons/index.ts에 등록)
├── utils/
│   ├── logger.ts              # 로깅 (dev: console, prod: Crashlytics)
│   ├── normalize.ts           # JSON 정규화 (App Group 시그니처 비교)
│   └── textFormatting.ts      # 제목 텍스트 포맷
└── constants/
    └── index.ts               # 폴링 간격, 임계값, 스토리지 키
```

### Native (Android)

| 경로 | 역할 |
|------|------|
| `android/.../rnmodule/NativeEventModule.kt` | JS에 `MyEventModule`로 노출. `ON_SERMON_UPDATE` 이벤트 emit |
| `android/.../rnmodule/WidgetUpdateModule.kt` | RN → Android 위젯 데이터 전달 |
| `android/.../widget/VerseWidget{Small,Large}.kt` | Glance AppWidget 구현 |
| `android/.../widget/VerseWidget{Small,Large}Receiver.kt` | AppWidget receiver/provider |
| `android/.../service/MyFirebaseMessagingService.kt` | FCM 메시지 수신/처리 |
| `android/.../analytics/CrashlyticsHelper.kt` | Crashlytics 래퍼 (원본 스택 보존) |

### Native (iOS)

| 경로 | 역할 |
|------|------|
| `ios/WidgetUpdateModule.swift` | RN → iOS 위젯 + App Group 읽기/쓰기 |
| `ios/MeditationBlossomWidget/MeditationBlossomWidget.swift` | WidgetKit 구현 |
| `ios/MeditationBlossomWidget/Sermon.swift` | Swift Sermon 모델 (TS 타입 미러) |
| `ios/PushNotificationService/NotificationService.swift` | Notification Service Extension (백그라운드 FCM 처리) |

App Group ID: `group.mannachurch.meditationblossom` (앱 + Widget Extension + NotificationService 공유)

## Conventions

- **언어**: TypeScript (RN), Kotlin (Android native), Swift (iOS native)
- **SVG**: `react-native-svg-transformer`로 React 컴포넌트 import. 타입은 `declaration.d.ts`에 선언
- **Navigation**: `@react-navigation/native-stack`, 타입 파라미터 `RootStackParamList`
- **Firebase**: `@react-native-firebase/*` v22.2.1 (Firestore, Messaging, Crashlytics, In-App Messaging)
- **폰트**: Pretendard (다중 weight, `src/assets/fonts/`)
- **브랜칭**: Trunk-based. `main` 단일 브랜치, `feature/issue-##` 단기 분기 → squash merge

## Testing

- 테스트 위치: `__tests__/*.test.ts`
- Jest 설정: `jest.config.js` (preset: `react-native`, setup: `jest.setup.js`)
- `jest.setup.js`에 Firebase, AsyncStorage, Crashlytics 등 mock 포함
- 순수 함수 중심 테스트: `Sermon.ts` 변환 함수, `sermonService.ts` staleness 체크, `normalize.ts`, `textFormatting.ts`

## Environment

- Node.js >= 18, React Native 0.78, React 19
- Android: targetSdk 35, minSdk 28, JDK 17
- iOS: deployment target 16.6, Ruby 3.0+ with CocoaPods
