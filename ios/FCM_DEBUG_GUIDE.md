# FCM 수신 문제 디버깅 가이드

## 체크리스트

### 1. 필수 설정 확인

#### 1.1 GoogleService-Info.plist 확인
```bash
ios/GoogleService-Info.plist 파일이 존재하는지 확인
```

#### 1.2 APNs 키 확인
- Firebase Console → Project Settings → Cloud Messaging → APNs Authentication Key
- .p8 파일이 업로드되어 있는지 확인

#### 1.3 Capabilities 확인
Xcode에서 다음 Capabilities가 활성화되어 있는지 확인:
- ✅ Push Notifications
- ✅ Background Modes → Remote notifications

### 2. 로그 확인

앱을 실행하고 Xcode 콘솔에서 다음 로그가 순서대로 나타나는지 확인:

#### 2.1 앱 시작 시
```
🔥 FCM delegate set
알림 권한 부여
🔥 APNS device token received
🔥 FCM APNS token set
Successfully subscribed to sermon_events topic
🔥 FCM registration token: [토큰]
```

**중요**: 만약 "알림 권한 부여" 로그가 없다면:
- 시뮬레이터가 아닌 **실기기**를 사용해야 함
- 또는 시뮬레이터의 Push Notification 권한 허용

### 3. FCM 메시지 전송 테스트

#### 3.1 백그라운드 테스트 (Data-only)
```bash
# 앱을 백그라운드로 보냄 (홈 화면으로 이동)
node test_fcm.js sendDataOnly sermon_events_test
```

**예상 로그**:
```
=== FCM MESSAGE RECEIVED (BACKGROUND) - didReceiveRemoteNotification:fetchCompletionHandler ===
```

#### 3.2 포그라운드 테스트
```bash
# 앱을 포그라운드에 둔 상태
node test_fcm.js sendDataOnly sermon_events_test
```

**예상 로그**:
```
=== FCM MESSAGE RECEIVED (FOREGROUND) - didReceiveRemoteNotification ===
```

### 4. 일반적인 문제

#### 문제 1: "알림 권한 부여" 로그가 없음

**원인**: 
- 시뮬레이터는 FCM을 제대로 지원하지 않음
- 실기기에서 테스트 필요

**해결**: 
- iPhone 실기기를 연결
- Xcode에서 해당 기기 선택 후 실행

#### 문제 2: "Failed to subscribe to sermon_events topic" 로그

**원인**:
- APNS 토큰이 제대로 설정되지 않음
- Firebase 프로젝트 설정 오류

**해결**:
1. Firebase Console 확인
2. APNs 키(.p8) 업로드 확인
3. Bundle ID 확인 (mannachurch.meditationblossom)

#### 문제 3: FCM registration token이 로그에 나타나지 않음

**원인**:
- Firebase 초기화 실패
- GoogleService-Info.plist 문제

**해결**:
1. GoogleService-Info.plist 파일 확인
2. Bundle ID가 Firebase Console과 일치하는지 확인
3. 파이어베이스 프로젝트 설정 확인

#### 문제 4: 메시지는 오는데 처리 안됨

**로그 확인**:
```
❌ Message not from sermon_events topic
```

**원인**: 
- Data 필드에 topic이 제대로 포함되지 않음
- 토픽 구독 실패

**해결**:
- test_fcm.js의 `sendDataOnlyMessage` 함수 확인
- Data 필드에 `topic` 키가 포함되는지 확인

### 5. 디버깅 절차

#### Step 1: 기본 로그 확인
앱 실행 후 다음 로그가 모두 나타나는지 확인:
```
🔥 FCM delegate set
알림 권한 부여
Successfully subscribed to sermon_events topic
🔥 FCM registration token: ...
```

**⚠️ 중요**: 모든 로그가 나타나지 않으면 다음 단계로 진행하지 말 것

#### Step 2: 알림 권한 확인
iOS 설정 앱 → meditation_blossom → 알림이 허용되어 있는지 확인

#### Step 3: FCM 토큰 확인
Xcode 콘솔에서 FCM 토큰 로그 복사
```
🔥 FCM registration token: [여기에 토큰]
```

#### Step 4: Firebase Console에서 직접 테스트
1. Firebase Console → Cloud Messaging → Send test message
2. FCM 토큰 입력
3. 메시지 전송
4. Xcode 로그 확인

#### Step 5: test_fcm.js 사용
```bash
# 백그라운드 데이터 전용 메시지
node test_fcm.js sendDataOnly sermon_events_test
```

### 6. 시뮬레이터 vs 실기기

**⚠️ 중요**: FCM은 시뮬레이터에서 제대로 작동하지 않습니다!

**시뮬레이터 제한사항**:
- APNS 토큰을 받지 못함
- 알림 권한이 항상 거부됨
- FCM 메시지를 받지 못함

**해결**: 반드시 **실기기**에서 테스트해야 합니다.

### 7. 체크리스트 요약

- [ ] GoogleService-Info.plist 존재
- [ ] APNs 키(.p8) Firebase Console에 업로드됨
- [ ] Bundle ID 일치 (mannachurch.meditationblossom)
- [ ] 실기기에서 테스트 (시뮬레이터 아님)
- [ ] 알림 권한 허용됨
- [ ] FCM delegate 설정 로그
- [ ] APNS 토큰 로그
- [ ] 토픽 구독 성공 로그
- [ ] FCM registration token 로그

### 8. 추가 리소스

- [Firebase Cloud Messaging 설정](https://firebase.google.com/docs/cloud-messaging/ios/client)
- [APNs 인증 키 설정](https://developer.apple.com/documentation/usernotifications/setting_up_a_remote_notification_server/establishing_a_token-based_connection_to_apns)
- [React Native Firebase 문서](https://rnfirebase.io/messaging/usage)

