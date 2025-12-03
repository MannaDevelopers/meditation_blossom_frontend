# APNs 인증 키 업로드 가이드

Firebase Cloud Messaging이 iOS에서 작동하려면 Apple Push Notification service (APNs) 인증 키가 필요합니다.

## 📋 개요

Firebase Console에 APNs 키를 업로드하는 방법을 단계별로 안내합니다.

## 🔑 단계 1: Apple Developer Console에서 APNs 키 생성

### 1.1 Apple Developer 계정으로 로그인
1. [Apple Developer](https://developer.apple.com/account)에 로그인
2. "Certificates, Identifiers & Profiles" 섹션으로 이동

### 1.2 Keys 섹션으로 이동
1. 왼쪽 사이드바에서 **"Keys"** 클릭
2. **"+"** 버튼 클릭 (Create a key)

### 1.3 APNs 키 생성
1. **"Key Name"** 입력: 예) "Firebase APNs Key"
2. **"Enable Apple Push Notifications service (APNs)"** 체크
   - ✅ 이 옵션만 체크하면 됩니다
3. **"Continue"** 클릭
4. **"Register"** 클릭

### 1.4 키 다운로드 (중요!)
1. **⚠️ 다운로드는 한 번만 가능합니다!**
2. **"Download"** 버튼 클릭
3. `.p8` 파일 저장 (예: `AuthKey_XXXXXXXXXX.p8`)
4. **Key ID** 복사 (나중에 필요합니다)

**중요**: `.p8` 파일을 안전한 곳에 보관하세요. 다시 다운로드할 수 없습니다!

## 🔥 단계 2: Firebase Console에 APNs 키 업로드

### 2.1 Firebase Console 접속
1. [Firebase Console](https://console.firebase.google.com) 접속
2. **muksang-mangae** 프로젝트 선택

### 2.2 Cloud Messaging 설정으로 이동
1. 좌측 메뉴에서 ⚙️ **"Settings"** 클릭
2. **"Project Settings"** 클릭
3. 상단 탭에서 **"Cloud Messaging"** 선택

### 2.3 APNs 인증 키 업로드
1. **"APNs Authentication Key"** 섹션 찾기
2. **"Upload"** 버튼 클릭
3. 다운로드한 `.p8` 파일 선택
4. **"Key ID"** 입력 (Apple Developer Console에서 복사한 ID)
5. **"Upload"** 클릭

### 2.4 확인
업로드가 완료되면 다음과 같이 표시됩니다:
- ✅ "APNs Authentication Key is set"
- Key ID 표시

## 📱 단계 3: Bundle ID 확인

### 3.1 Firebase Console에서 확인
1. **"Project Settings"** → **"General"** 탭
2. **"Your apps"** 섹션에서 iOS 앱 확인
3. Bundle ID가 **`mannachurch.meditationblossom`**인지 확인

### 3.2 Bundle ID가 다른 경우
1. **"Add app"** 클릭하여 새 iOS 앱 추가
2. Bundle ID: `mannachurch.meditationblossom`
3. **GoogleService-Info.plist** 다운로드
4. `ios/GoogleService-Info.plist` 교체

## 🧪 단계 4: 테스트

### 4.1 Firebase Console에서 직접 테스트
1. **Cloud Messaging** → **"Send test message"** 클릭
2. FCM 토큰 입력 (앱에서 로그로 확인)
3. 테스트 메시지 작성
4. **"Test"** 클릭

### 4.2 앱 로그 확인
Xcode 콘솔에서 다음 로그 확인:
```
🔥 APNS device token received
Successfully subscribed to sermon_events topic
🔥 FCM registration token: [토큰]
```

### 4.3 FCM 메시지 수신 확인
```bash
# test_fcm.js 사용
node test_fcm.js sendDataOnly sermon_events_test
```

**예상 로그**:
```
=== FCM MESSAGE RECEIVED (BACKGROUND) ===
```

## ⚠️ 주의사항

### 개발 vs 프로덕션
- **Development**: 개발용 (Sandbox APNs)
- **Production**: 프로덕션용 (Production APNs)

Firebase Console에서 **두 환경 모두** 키를 업로드해야 합니다:
1. Development 키 업로드
2. Production 키 업로드 (같은 키 사용 가능)

### 팀 ID 확인
APNs 키를 업로드할 때 **Team ID**가 필요할 수 있습니다.

확인 방법:
1. Xcode → Target → General → Signing & Capabilities
2. **Team** 섹션에서 확인

### 일반적인 문제

#### 문제 1: "Invalid APNs key"
- **원인**: 잘못된 키 파일
- **해결**: Apple Developer Console에서 새 키 생성

#### 문제 2: "Key ID mismatch"
- **원인**: Key ID를 잘못 입력
- **해결**: Apple Developer Console에서 Key ID 다시 확인

#### 문제 3: "Team ID required"
- **원인**: 팀 ID 누락
- **해결**: Xcode에서 Team ID 확인 후 입력

## 📞 추가 도움

- [Apple APNs 문서](https://developer.apple.com/documentation/usernotifications/setting_up_a_remote_notification_server)
- [Firebase APNs 설정](https://firebase.google.com/docs/cloud-messaging/ios/certs)
- [React Native Firebase APNs 가이드](https://rnfirebase.io/messaging/usage#apns)

## ✅ 체크리스트

- [ ] Apple Developer Console에서 APNs 키 생성
- [ ] `.p8` 파일 다운로드 및 저장
- [ ] Key ID 복사
- [ ] Firebase Console → Cloud Messaging
- [ ] Development APNs 키 업로드
- [ ] Production APNs 키 업로드
- [ ] Team ID 입력 (필요한 경우)
- [ ] Firebase Console에서 테스트 메시지 전송
- [ ] 앱에서 FCM 토큰 로그 확인
- [ ] test_fcm.js로 메시지 테스트

## 🔍 키가 없을 때

만약 `.p8` 파일을 잃어버렸다면:
1. Apple Developer Console에서 새 키 생성
2. Firebase Console의 기존 키 제거
3. 새 키 업로드

**⚠️ 주의**: 키를 교체할 때 기존 키는 즉시 무효화됩니다!

