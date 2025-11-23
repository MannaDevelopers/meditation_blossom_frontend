# WidgetKit Push Notifications 테스트 가이드

## 중요: NotificationService Extension 실행 조건

**NotificationService Extension은 실제 푸시 알림을 받을 때만 실행됩니다.**

- ❌ 위젯 Extension을 직접 실행 → NotificationService Extension 실행 안 됨
- ❌ 앱을 실행 → NotificationService Extension 실행 안 됨
- ✅ 실제 FCM 푸시 알림 수신 → NotificationService Extension 실행됨

## 앱 종료 상태에서의 제한 사항

iOS는 배터리 절약을 위해 **앱이 완전히 종료된 상태**에서 silent push (`content-available: 1`)를 제한적으로 처리합니다:

1. **최근 사용한 앱**: silent push가 작동할 수 있음
2. **오래 실행하지 않은 앱**: silent push가 작동하지 않을 수 있음
3. **Background App Refresh 비활성화**: silent push가 작동하지 않음

## WidgetKit Push 테스트 방법

### 방법 1: 앱이 백그라운드에 있을 때 (권장)

1. 앱을 실행하고 백그라운드로 보냄 (홈 버튼 누르기)
2. FCM 메시지 전송:
   ```bash
   node test_fcm.js sendWidgetKitPush sermon_events_test
   ```
3. Xcode에서 **PushNotificationService Extension**의 로그 확인:
   - Xcode 상단에서 타겟을 "PushNotificationService"로 변경
   - Console에서 "📬 NotificationService:" 로그 확인

### 방법 2: 앱이 포그라운드에 있을 때

1. 앱을 포그라운드에서 실행
2. FCM 메시지 전송
3. `AppDelegate.mm`의 로그 확인 (하지만 WidgetKit Push는 NotificationService에서 처리됨)

### 방법 3: 앱이 종료된 상태에서 (제한적)

1. 앱을 완전히 종료 (스와이프 업)
2. FCM 메시지 전송
3. **주의**: iOS가 silent push를 제한할 수 있음
4. NotificationService Extension이 실행되지 않을 수 있음

## 로그 확인 방법

### NotificationService Extension 로그 보기

1. Xcode에서 타겟 선택: 상단에서 "meditation_blossom" → "PushNotificationService"로 변경
2. Console 필터: "NotificationService" 또는 "📬" 검색
3. 예상되는 로그:
   ```
   📬 NotificationService: Received notification userInfo: ...
   📬 NotificationService: All keys in userInfo: ...
   📬 Found widgetkit at top level (또는 Found widgetkit inside aps)
   🎯 WidgetKit Push Notification detected for MeditationBlossomWidget
   📦 WidgetKit Push: Processing widgetkit data
   ✅ WidgetKit Push: Widget timeline reloaded
   ```

### 위젯 Extension 로그 보기

1. Xcode에서 타겟 선택: "MeditationBlossomWidget"로 변경
2. Console 필터: "Widget:" 또는 "타임라인" 검색
3. 예상되는 로그:
   ```
   타임라인 로딩
   ✅ Widget: Found sermon data - ...
   ```

## 문제 해결

### NotificationService Extension 로그가 보이지 않는 경우

1. **확인 사항**:
   - 실제 FCM 메시지를 보냈는가?
   - 앱이 완전히 종료된 상태인가? (silent push 제한 가능)
   - Background App Refresh가 활성화되어 있는가?

2. **해결 방법**:
   - 앱을 백그라운드로 보내고 테스트
   - Xcode에서 타겟을 "PushNotificationService"로 변경하고 로그 확인
   - Firebase Console에서 메시지 전송 상태 확인

### widgetkit 데이터가 전달되지 않는 경우

현재 구현에서는 `widgetkit.data`가 없으면 `message.data`를 fallback으로 사용합니다. 이는 정상 동작입니다.

로그에서 다음을 확인:
- `📬 Found widgetkit at top level` 또는 `📬 Found widgetkit inside aps` → widgetkit 데이터 사용
- `ℹ️ No widgetkit found, treating as regular FCM message` → message.data 사용 (fallback)

## 참고

- WidgetKit Push Notifications는 iOS 16+에서만 지원됩니다
- NotificationService Extension은 별도의 프로세스로 실행됩니다
- 위젯 Extension과 NotificationService Extension은 서로 다른 타겟입니다

