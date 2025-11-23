# Firebase In-App Messaging 테스트 가이드

## ⚠️ 중요한 이해사항

**Firebase In-App Messaging은 푸시 알림이 아닙니다!** 
- 이벤트 트리거 시 앱 내부에 모달/배너로 표시됩니다
- Firebase Console에서 "Test on device"는 테스트용 특별한 FCM 메시지를 전송합니다

## Firebase Console "Test on device" 동작 방식

1. **Installation ID 입력**: Firebase Console에 테스트 기기의 Installation ID 입력
2. **테스트 FCM 전송**: Firebase가 해당 기기로 특별한 테스트 FCM 메시지 전송
3. **앱 내부 표시**: 앱이 FCM을 받으면 In-App Messaging UI를 표시

## 현재 설정 상태

✅ **완료된 설정**:
- Firebase Analytics 활성화 (`IS_ANALYTICS_ENABLED = true`)
- Firebase In-App Messaging Pod 설치
- `automaticDataCollectionEnabled = YES`
- `messageDisplaySuppressed = NO`
- `app_foreground` 이벤트 트리거 코드 추가

## 테스트 시나리오

### 시나리오 1: "Test on device" 버튼 사용

1. **Firebase Console 설정**:
   - Firebase Console > In-App Messaging > 해당 캠페인 선택
   - "Test on device" 버튼 클릭
   - Installation ID 입력 (Xcode 콘솔에서 확인)
   
2. **앱 상태**:
   - 앱이 실행 중 (포그라운드 또는 백그라운드)
   - 인터넷 연결 필수

3. **예상 동작**:
   - Firebase가 테스트 FCM 메시지 전송
   - 앱이 FCM을 받으면 즉시 In-App Messaging UI 표시
   - **즉시 표시됩니다** (일반 캠페인과 다름)

### 시나리오 2: 일반 캠페인 (이벤트 트리거)

1. **Firebase Console 설정**:
   - In-App Messaging 캠페인 생성
   - Trigger: `app_foreground` 선택
   - Published 상태로 설정

2. **앱 동작**:
   - 앱이 시작되면 `triggerEvent:@"app_foreground"` 호출
   - Firebase 서버에서 해당 이벤트를 감지
   - 조건에 맞는 메시지가 있으면 다운로드
   - **메시지가 표시될 수 있음** (캠페인 설정에 따라)

## 디버깅 체크리스트

### 1. Xcode 로그 확인

앱 실행 시 다음 로그가 모두 나와야 합니다:

```
✅ Firebase In-App Messaging initialized
✅ AppDelegate initialization complete
✅ Installation ID: [your-installation-id]
🔥 Triggering app_foreground event...
✅ app_foreground event triggered
In-App Messaging settings: suppressed=0, dataCollection=1
```

**문제가 있다면**:
- Installation ID가 안 나옴 → Firebase Analytics 초기화 실패
- `suppressed=1` → 메시지 표시가 억제됨
- `dataCollection=0` → 데이터 수집 비활성화

### 2. Firebase Console 확인

#### 캠페인 설정 확인:
- ✅ **Message status**: Published
- ✅ **Trigger type**: `app_foreground` (또는 "App foreground")
- ✅ **Scheduling**: 현재 시간이 시작일과 종료일 사이
- ✅ **Targeting**: 아무 조건도 없거나, 현재 기기/사용자가 조건을 만족

#### Analytics 확인:
- Firebase Console > Analytics > Events
- `app_foreground` 이벤트가 기록되는지 확인

### 3. 네트워크 확인

In-App Messaging은 네트워크 연결이 **필수**입니다:
- 시뮬레이터: Wi-Fi/인터넷 연결 확인
- 실제 기기: 셀룰러/Wi-Fi 연결 확인
- **방화벽**: Firebase 서버 접근 허용 확인

### 4. 기기 상태 확인

- **시뮬레이터**: 일부 In-App Messaging 기능이 제한될 수 있음
- **실제 기기**: 권장

## 일반적인 문제

### 문제 1: "Test on device" 클릭했는데 아무것도 안 나옴

**가능한 원인**:
1. **잘못된 Installation ID**: Xcode 콘솔에서 정확한 ID 확인
2. **앱이 꺼짐**: 앱이 완전히 종료되어 있으면 안 됨
3. **네트워크 문제**: 인터넷 연결 확인
4. **시뮬레이터**: 실제 기기로 테스트

**해결책**:
- Xcode 콘솔의 Installation ID를 다시 확인
- 앱을 포그라운드로 실행
- 실제 기기에서 테스트
- 기기 재부팅 후 재시도

### 문제 2: 이벤트 트리거는 되는데 메시지가 안 나옴

**가능한 원인**:
1. **캠페인 조건**: Frequency capping, 사용자 세그먼트 등의 조건
2. **캠페인 기간**: 시작일/종료일 확인
3. **이미 표시됨**: 한 번 표시된 메시지는 다시 안 나올 수 있음

**해결책**:
- Firebase Console > 캠페인 설정 > 조건 모두 제거
- Frequency capping 비활성화
- 캠페인 기간을 현재 시간 포함하도록 설정
- 테스트를 위해 새 캠페인 생성

### 문제 3: Analytics 이벤트가 기록되지 않음

**가능한 원인**:
- Firebase Analytics가 제대로 초기화되지 않음

**해결책**:
```bash
# Podfile 확인
pod 'Firebase/Analytics'  # 이 줄이 있어야 함

# GoogleService-Info.plist 확인
IS_ANALYTICS_ENABLED = true  # 이 값이 true여야 함

# pod install 재실행
cd ios && pod install
```

## 권장 테스트 플로우

1. **Firebase Console에서 캠페인 생성**:
   - Trigger: `app_foreground`
   - 조건 없음
   - Frequency capping 없음
   - Published 상태

2. **앱 실행**:
   - Xcode에서 앱 실행
   - Installation ID 확인
   - "Test on device" 버튼 클릭하여 즉시 테스트
   - 또는 앱 재시작하여 이벤트 트리거

3. **메시지 확인**:
   - 앱 화면에 모달/배너 메시지 표시 확인
   - Firebase Console > Analytics에서 이벤트 기록 확인

4. **프로덕션 배포**:
   - 테스트 완료 후 `triggerEvent:@"app_foreground"` 코드 제거 (또는 조건부로 처리)

## 추가 참고

- Firebase In-App Messaging은 **시간이 걸릴 수 있습니다** (최대 1분 정도)
- **한 번 표시된 메시지는 다시 안 나올 수 있습니다** (Frequency capping)
- **Firebase Console의 보고서는 실시간이 아닙니다** (지연 가능)

## 정말로 작동하지 않는다면

다음 코드를 추가하여 강제로 메시지를 표시해보세요:

```objective-c
// AppDelegate.mm의 didFinishLaunchingWithOptions에 추가
dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(5.0 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
    NSLog(@"Retrying app_foreground event trigger...");
    [[FIRInAppMessaging inAppMessaging] triggerEvent:@"app_foreground"];
});
```

이렇게 하면 앱 시작 후 5초 뒤에 다시 이벤트를 트리거합니다.

