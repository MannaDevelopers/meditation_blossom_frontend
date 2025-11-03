# Firebase In-App Messaging iOS 설정 가이드

## 설치 완료 ✅

Firebase In-App Messaging이 iOS 앱에 성공적으로 설치되었습니다.

## 변경 사항

### 1. Podfile 수정
- `pod 'Firebase/InAppMessaging'` 추가

### 2. AppDelegate.h
- `#import <FirebaseInAppMessaging/FirebaseInAppMessaging.h>` 추가

### 3. AppDelegate.mm
- `#import <FirebaseInAppMessaging/FirebaseInAppMessaging.h>` 추가
- In-App Messaging 초기화 코드 추가:
```objective-c
[FIRInAppMessaging inAppMessaging].messageDisplaySuppressed = NO;
```

## Firebase Console에서 메시지 생성 방법

### 1. Firebase Console 접속
1. [Firebase Console](https://console.firebase.google.com/) 접속
2. 프로젝트 선택 (`muksang-mangae`)
3. 왼쪽 메뉴에서 **In-App Messaging** 선택

### 2. 새 메시지 생성
1. **"만들기"** 또는 **"New campaign"** 버튼 클릭
2. 메시지 유형 선택:
   - **Banner**: 상단에 배너 메시지 표시
   - **Modal**: 화면 중앙에 모달 다이얼로그
   - **Image**: 이미지와 함께 표시되는 메시지
   - **Card**: 카드 형태로 표시

### 3. 메시지 내용 작성
- **제목** (Title): 메시지 제목
- **본문** (Body Text): 메시지 내용
- **버튼 텍스트** (Button Text): 액션 버튼 텍스트
- **버튼 액션** (Button Action): 버튼 클릭 시 동작

### 4. 타겟팅 설정
- **이벤트 기반**: 특정 이벤트 발생 시 표시
- **사용자 속성**: 특정 사용자 그룹에게만 표시
- **조건**: 여러 조건 조합 가능

### 5. 테스트
1. **"Test device"** 섹션에서 테스트 기기 추가
   - 테스트 기기의 FCM 토큰 입력
   - 또는 **Test on device** 버튼으로 앱에서 직접 테스트
2. **"Preview"** 버튼으로 미리보기

### 6. 출시
1. **"Next"** 또는 **"Save"** 클릭
2. 메시지 상태를 **"Published"**로 변경
3. 메시지가 활성 사용자에게 표시됨

## 프로그래매틱 이벤트 트리거

앱에서 특정 이벤트를 트리거하면 In-App Messaging이 자동으로 표시됩니다:

```objective-c
// Objective-C
[[FIRInAppMessaging inAppMessaging] triggerEvent:@"sermon_received"];
```

```swift
// Swift
FIRInAppMessaging.inAppMessaging().triggerEvent("sermon_received")
```

## 메시지 표시 제어

특정 상황에서 메시지 표시를 일시적으로 억제할 수 있습니다:

```objective-c
// 메시지 표시 억제
[FIRInAppMessaging inAppMessaging].messageDisplaySuppressed = YES;

// 메시지 표시 재개
[FIRInAppMessaging inAppMessaging].messageDisplaySuppressed = NO;
```

## 사용 예시

### 시나리오 1: 새로운 설교가 도착했을 때
```objective-c
- (void)saveFcmSermon:(NSDictionary *)data {
  // ... 기존 코드 ...
  
  // In-App Messaging 이벤트 트리거
  [[FIRInAppMessaging inAppMessaging] triggerEvent:@"new_sermon_received"];
  
  NSLog(@"✅ Successfully saved FCM sermon to App Group");
}
```

### 시나리오 2: 사용자가 3일 이상 사용하지 않았을 때
Firebase Console에서:
- **조건**: Last app open < 3 days ago
- **메시지**: "새로운 묵상 자료가 도착했습니다!"

## 모니터링

Firebase Console의 In-App Messaging 대시보드에서:
- 표시 횟수 (Impressions)
- 클릭률 (Click-through rate)
- 전환율 (Conversion rate)

확인 가능

## 주의사항

1. **GDPR 준수**: In-App Messaging은 사용자 데이터를 사용하므로 개인정보 처리방침에 명시
2. **사용자 경험**: 과도한 메시지는 사용자 경험을 해칠 수 있음
3. **테스트 필수**: 출시 전 반드시 테스트 기기에서 검증
4. **네트워크**: In-App Messaging은 인터넷 연결이 필요

## 추가 리소스

- [Firebase In-App Messaging 문서](https://firebase.google.com/docs/in-app-messaging)
- [iOS 가이드](https://firebase.google.com/docs/in-app-messaging/ios)
- [베스트 프랙티스](https://firebase.google.com/docs/in-app-messaging/best-practices)

## 문제 해결

### 메시지가 표시되지 않는 경우
1. Firebase Console에서 메시지가 **Published** 상태인지 확인
2. 네트워크 연결 확인
3. 앱을 완전히 종료 후 재시작
4. Xcode에서 로그 확인:
```objective-c
NSLog(@"In-App Messaging: %@", [FIRInAppMessaging inAppMessaging]);
```

### 빌드 오류 발생 시
```bash
cd ios
rm -rf Pods Podfile.lock
pod install
```

## 다음 단계

1. Firebase Console에서 테스트 메시지 생성
2. 앱을 실행하여 메시지 표시 확인
3. 필요한 이벤트 트리거 추가
4. 프로덕션 출시

