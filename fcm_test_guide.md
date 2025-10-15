# FCM 백그라운드 테스트 가이드

## 1. Firebase Console에서 테스트

### 1.1 Firebase Console 접속
1. [Firebase Console](https://console.firebase.google.com/) 접속
2. 프로젝트 `muksang-mangae` 선택
3. 왼쪽 메뉴에서 "Messaging" 선택

### 1.2 테스트 메시지 전송
1. "Send your first message" 또는 "Create your first campaign" 클릭
2. 메시지 유형: "Notification message" 선택
3. 메시지 내용 입력:
   - **제목**: "테스트 메시지"
   - **본문**: "앱이 꺼져있을 때 FCM 테스트"
4. **Target** 섹션에서:
   - "Send test message" 선택
   - **FCM registration token** 입력 (앱에서 로그로 확인)
5. **Additional options** 섹션에서:
   - **Data** 추가:
     ```
     date: "2024-01-15"
     title: "테스트 설교"
     content: "백그라운드 FCM 테스트 내용"
     day_of_week: "월요일"
     ```
6. "Test" 버튼 클릭

### 1.3 토픽으로 테스트
1. **Target** 섹션에서 "Topic" 선택
2. 토픽 이름: `sermon_events` 입력
3. 위와 동일한 메시지 내용 입력
4. "Test" 버튼 클릭

## 2. 앱에서 FCM 토큰 확인

### 2.1 Android에서 토큰 확인 (Windows)
```cmd
# Android Studio Logcat에서 확인
adb logcat | findstr "FCM"
```

### 2.2 iOS에서 토큰 확인
```bash
# Xcode Console에서 확인
# 또는 앱 내에서 console.log로 출력된 토큰 확인
```

### 2.3 React Native에서 토큰 확인
앱을 실행하고 HomeScreen에서 다음 로그 확인:
```
FCM Token: [토큰값]
```

## 3. 백그라운드 테스트 단계

### 3.1 테스트 준비
1. 앱을 실행하여 FCM 토큰 확인
2. Firebase Console에서 테스트 메시지 준비
3. 앱을 완전히 종료 (백그라운드에서도 제거)

### 3.2 테스트 실행
1. Firebase Console에서 테스트 메시지 전송
2. 기기에서 알림 확인
3. 알림을 탭하여 앱 실행
4. 앱이 올바른 데이터로 업데이트되었는지 확인

## 4. 로그 확인 방법

### ⚠️ 중요: 앱 상태별 로그 확인 방법

#### 4.1 앱이 완전히 종료된 상태 (백그라운드 FCM)
**React Native 로그는 보이지 않습니다!** 네이티브 로그만 확인하세요.

**Android (Windows):**
```cmd
# FCM 관련 로그만 확인
adb logcat | findstr "FCM"

# 더 상세한 로그
adb logcat | findstr "=== FCM"

# MyFirebaseMessagingService 로그 확인
adb logcat | findstr "MyFirebaseMessagingService"

# 모든 Firebase 관련 로그
adb logcat | findstr "Firebase"

# 모든 로그 확인 (필요시)
adb logcat
```

**iOS:**
- Xcode → Window → Devices and Simulators
- 기기 선택 → View Device Logs
- "FCM" 또는 "Firebase" 키워드로 검색

#### 4.2 앱이 백그라운드에 있는 상태
**React Native 로그는 보이지 않습니다!** 네이티브 로그만 확인하세요.

#### 4.3 앱이 포그라운드에 있는 상태
**React Native 로그가 보입니다!**
```cmd
# Metro bundler 로그 확인
npx react-native log-android
npx react-native log-ios
```

### 4.4 앱을 다시 열었을 때 (React Native 로그)
앱을 FCM 알림으로 열면 React Native 로그가 보입니다:
```cmd
# Metro bundler 로그에서 확인
npx react-native log-android
npx react-native log-ios

# 예상되는 로그:
# === APP OPENED FROM BACKGROUND VIA FCM ===
# Remote message: {...}
# From: /topics/sermon_events
# Data: {...}
```

## 5. 문제 해결

### 5.1 알림이 오지 않는 경우
1. **권한 확인**: 앱 설정에서 알림 권한이 허용되었는지 확인
2. **토큰 확인**: FCM 토큰이 올바르게 생성되었는지 확인
3. **토픽 구독 확인**: `sermon_events` 토픽에 구독되었는지 확인

### 5.2 백그라운드에서 데이터 업데이트 안 되는 경우
1. **Android**: `MyFirebaseMessagingService.kt`의 `onMessageReceived` 메서드 확인
2. **iOS**: `AppDelegate.mm`의 백그라운드 처리 메서드 확인
3. **위젯 업데이트**: 위젯이 올바르게 업데이트되는지 확인

### 5.3 로그가 안 보이는 경우
1. **올바른 로그 확인**: 앱 상태에 따라 네이티브 로그 vs React Native 로그 구분
2. **로그 레벨 확인**: Debug 로그가 활성화되어 있는지 확인
3. **기기 재연결**: USB 디버깅 재연결 후 로그 확인

### 5.4 디버깅을 위한 로그 추가

#### Android (MyFirebaseMessagingService.kt)
```kotlin
override fun onMessageReceived(message: RemoteMessage) {
    super.onMessageReceived(message)
    Timber.d("=== FCM BACKGROUND MESSAGE RECEIVED ===")
    Timber.d("From: ${message.from}")
    Timber.d("Data: ${message.data}")
    Timber.d("Notification: ${message.notification}")
    
    // 기존 코드...
}
```

#### iOS (AppDelegate.mm)
```objc
- (void)userNotificationCenter:(UNUserNotificationCenter *)center
didReceiveNotificationResponse:(UNNotificationResponse *)response
         withCompletionHandler:(void(^)(void))completionHandler {
    NSDictionary *userInfo = response.notification.request.content.userInfo;
    NSLog(@"=== FCM BACKGROUND NOTIFICATION TAPPED ===");
    NSLog(@"UserInfo: %@", userInfo);
    
    // 기존 코드...
    completionHandler();
}
```

## 6. 성공적인 테스트 확인 사항

1. ✅ 앱이 완전히 종료된 상태에서 알림 수신
2. ✅ 알림을 탭했을 때 앱이 실행됨
3. ✅ 새로운 설교 데이터가 앱에 반영됨
4. ✅ 위젯이 새로운 데이터로 업데이트됨
5. ✅ **네이티브 로그**에서 백그라운드 메시지 수신 확인
6. ✅ **React Native 로그**에서 앱 실행 시 초기 알림 처리 확인

## 7. 추가 테스트 시나리오

### 7.1 다양한 앱 상태에서 테스트
- 앱이 포그라운드에 있을 때 (React Native 로그 확인)
- 앱이 백그라운드에 있을 때 (네이티브 로그 확인)
- 앱이 완전히 종료되었을 때 (네이티브 로그 확인)

### 7.2 네트워크 상태별 테스트
- WiFi 연결 상태
- 모바일 데이터 연결 상태
- 네트워크 연결 없음 상태

### 7.3 기기별 테스트
- 다양한 Android 기기
- 다양한 iOS 기기
- 에뮬레이터/시뮬레이터

## 8. iOS DEBUG vs RELEASE 빌드 차이점

### 8.1 DEBUG 빌드 (개발/테스트용)
- ✅ `sermon_events` 토픽 구독 및 처리
- ✅ `sermon_events_test` 토픽 구독 및 처리 (테스트 전용)
- ✅ 상세한 디버그 로그 출력
- ⚠️ 성능 최적화 비활성화

### 8.2 RELEASE 빌드 (프로덕션용)
- ✅ `sermon_events` 토픽 구독 및 처리
- ❌ `sermon_events_test` 토픽 무시 (구독하지 않음)
- ⚠️ 최소한의 로그만 출력
- ✅ 성능 최적화 활성화

### 8.3 iOS 빌드 모드별 테스트 방법

#### **방법 1: React Native CLI 사용** (권장)

**DEBUG 모드**:
```bash
# 실기기에서 DEBUG 빌드
npx react-native run-ios --device "기기이름"

# 시뮬레이터에서 DEBUG 빌드
npx react-native run-ios --simulator "iPhone 15"
```

**RELEASE 모드**:
```bash
# 실기기에서 RELEASE 빌드
npx react-native run-ios --device "기기이름" --configuration Release

# 시뮬레이터에서 RELEASE 빌드
npx react-native run-ios --simulator "iPhone 15" --configuration Release
```

#### **방법 2: Xcode 사용**

1. **Scheme 설정 변경**:
   - Xcode에서 `meditation_blossom.xcworkspace` 열기
   - 상단 메뉴: `Product` → `Scheme` → `Edit Scheme...`
   - 왼쪽에서 `Run` 선택
   - `Build Configuration` 변경:
     - `Debug` → 개발/테스트용
     - `Release` → 프로덕션용
   - Close

2. **빌드 및 실행**:
   - 디바이스 선택 (상단에서 기기 선택)
   - `⌘ + R` 또는 `Product` → `Run`

#### **방법 3: 명령줄에서 직접 빌드**

**DEBUG 빌드**:
```bash
cd ios
xcodebuild -workspace meditation_blossom.xcworkspace \
  -scheme meditation_blossom \
  -configuration Debug \
  -destination 'name=기기이름' \
  -allowProvisioningUpdates
```

**RELEASE 빌드**:
```bash
cd ios
xcodebuild -workspace meditation_blossom.xcworkspace \
  -scheme meditation_blossom \
  -configuration Release \
  -destination 'name=기기이름' \
  -allowProvisioningUpdates
```

### 8.4 빌드 모드별 테스트 시나리오

#### **DEBUG 모드 테스트**:

1. **sermon_events_test 토픽 테스트**:
   ```bash
   node test_fcm.js sendDataOnly sermon_events_test
   ```
   
   **예상 로그**:
   ```
   [DEBUG] Successfully subscribed to sermon_events_test topic
   === FCM DATA-ONLY MESSAGE RECEIVED (BACKGROUND) ===
   Topic from data: sermon_events_test
   ✅ Processing sermon_events_test data-only message in background
   ✅ Successfully saved FCM sermon to App Group
   ✅ Widget timelines reloaded via WidgetUpdateModule
   ```

2. **sermon_events 토픽 테스트**:
   ```bash
   node test_fcm.js sendDataOnly sermon_events
   ```
   
   **예상 로그**:
   ```
   Successfully subscribed to sermon_events topic
   === FCM DATA-ONLY MESSAGE RECEIVED (BACKGROUND) ===
   Topic from data: sermon_events
   ✅ Processing sermon_events data-only message in background
   ```

#### **RELEASE 모드 테스트**:

1. **sermon_events_test 토픽 테스트** (무시되어야 함):
   ```bash
   node test_fcm.js sendDataOnly sermon_events_test
   ```
   
   **예상 로그**:
   ```
   === FCM DATA-ONLY MESSAGE RECEIVED (BACKGROUND) ===
   Topic from data: sermon_events_test
   ❌ Message not from sermon_events topic
   ```
   ⚠️ **sermon_events_test는 구독조차 하지 않으므로 메시지가 오지 않을 수 있음**

2. **sermon_events 토픽 테스트** (정상 작동해야 함):
   ```bash
   node test_fcm.js sendDataOnly sermon_events
   ```
   
   **예상 로그**:
   ```
   Successfully subscribed to sermon_events topic
   === FCM DATA-ONLY MESSAGE RECEIVED (BACKGROUND) ===
   Topic from data: sermon_events
   ✅ Processing sermon_events data-only message in background
   ✅ Successfully saved FCM sermon to App Group
   ✅ Widget timelines reloaded via WidgetUpdateModule
   ```

### 8.5 빌드 모드 확인 방법

**로그에서 확인**:
```
# DEBUG 모드
[DEBUG] Successfully subscribed to sermon_events_test topic

# RELEASE 모드
sermon_events_test 관련 로그 없음
```

**Xcode에서 확인**:
- 상단 바에서 현재 Scheme 확인
- `meditation_blossom > 기기이름` 옆에 현재 Configuration 표시

### 8.6 토픽별 사용 용도

| 토픽 | 용도 | DEBUG | RELEASE |
|------|------|-------|---------|
| `sermon_events` | 프로덕션 설교 업데이트 | ✅ | ✅ |
| `sermon_events_test` | iOS 개발/테스트 전용 | ✅ | ❌ |

⚠️ **중요**: 
- `sermon_events_test`는 DEBUG 모드에서만 작동하므로 Android 사용자에게 영향을 주지 않습니다.
- RELEASE 빌드는 App Store 배포 전 테스트용으로 사용하세요.

## 9. 로그 확인 체크리스트

### 앱이 꺼져있을 때 (백그라운드 FCM)
- [ ] Android: `adb logcat | findstr "=== FCM"`에서 로그 확인
- [ ] iOS: Xcode Device Logs에서 FCM 관련 로그 확인
- [ ] 알림이 기기에 표시되는지 확인
- [ ] 알림을 탭했을 때 앱이 실행되는지 확인

### 앱을 다시 열었을 때 (React Native)
- [ ] Metro bundler 로그에서 `=== APP OPENED FROM BACKGROUND VIA FCM ===` 확인
- [ ] 앱 데이터가 업데이트되었는지 확인
- [ ] 위젯이 업데이트되었는지 확인

### iOS 빌드 모드별 테스트
- [ ] DEBUG: sermon_events_test 토픽이 정상 작동하는지 확인
- [ ] RELEASE: sermon_events_test 토픽이 무시되는지 확인
- [ ] RELEASE: sermon_events 토픽은 정상 작동하는지 확인 