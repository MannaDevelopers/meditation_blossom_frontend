# Firebase In-App Messaging 트러블슈팅 가이드

iOS 앱에서 In-App Messaging이 표시되지 않는 문제를 해결하는 방법입니다.

## 1. 기본 설정 확인

### 1.1. AppDelegate 확인
`ios/meditation_blossom/AppDelegate.mm`에서 다음 설정이 있는지 확인:

```objective-c
#import <FirebaseInAppMessaging/FirebaseInAppMessaging.h>

// didFinishLaunchingWithOptions 메서드 내
[FIRInAppMessaging inAppMessaging].messageDisplaySuppressed = NO;
```

### 1.2. Podfile 확인
`ios/Podfile`에 다음이 있는지 확인:

```ruby
pod 'Firebase/InAppMessaging'
```

Pod 설치:
```bash
cd ios
pod install
```

## 2. Firebase Console에서 메시지 설정 확인

### 2.1. 이벤트 트리거 유형
Firebase In-App Messaging은 **이벤트 기반 트리거**를 사용합니다. 

**자동으로 트리거되는 이벤트**:
- `first_open`: 앱을 처음 실행할 때
- `app_update`: 앱 업데이트 후
- `app_foreground`: 앱이 포그라운드로 전환될 때

**커스텀 이벤트**:
- 앱에서 `triggerEvent`를 명시적으로 호출해야 함

### 2.2. Firebase Console에서 "App foreground" 이벤트 설정

1. Firebase Console > In-App Messaging
2. 새 캠페인 생성
3. **Target** 섹션에서:
   - Trigger type: **App foreground** 선택
   - **중요**: 이 옵션은 실제로는 `app_foreground` 이벤트를 트리거합니다
4. 추가 조건 설정:
   - Frequency capping
   - User segments
   - Device languages
   - 등

### 2.3. 메시지 상태 확인
- 메시지가 **Published** 상태인지 확인
- 메시지의 시작일/종료일 확인
- 테스트 기기가 등록되어 있는지 확인

## 3. 수동 이벤트 트리거 테스트

Firebase Console의 "App foreground" 트리거가 제대로 작동하지 않는 경우, 명시적으로 이벤트를 트리거할 수 있습니다.

### 3.1. AppDelegate에서 트리거

```objective-c
// AppDelegate.mm의 didFinishLaunchingWithOptions 메서드에 추가
- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  // ... 기존 코드 ...
  
  [FIRInAppMessaging inAppMessaging].messageDisplaySuppressed = NO;
  
  // 앱 시작 시 이벤트 트리거 (테스트용)
  [[FIRInAppMessaging inAppMessaging] triggerEvent:@"app_foreground"];
  
  // ... 나머지 코드 ...
}
```

### 3.2. React Native에서 트리거

`src/screens/HomeScreen.tsx`에 Native Module 추가:

```typescript
import { NativeModules } from 'react-native';

// HomeScreen 컴포넌트 내
useEffect(() => {
  // 앱이 포그라운드로 전환될 때
  const subscription = AppState.addEventListener('change', (nextAppState) => {
    if (nextAppState === 'active') {
      // Native Module을 통해 이벤트 트리거 (필요시 구현)
      console.log('App came to foreground');
    }
  });

  return () => {
    subscription?.remove();
  };
}, []);
```

## 4. 디버깅 단계

### 4.1. 앱 로그 확인
Xcode Console에서 다음 로그를 확인:

```
Firebase In-App Messaging initialized
AppDelegate initialization complete
```

이 로그가 없다면 In-App Messaging이 제대로 초기화되지 않은 것입니다.

### 4.2. Firebase Console 로그 확인
Firebase Console > In-App Messaging > Analytics에서:
- 메시지가 전송되었는지 확인
- 어떤 이벤트가 트리거되었는지 확인
- 에러 로그 확인

### 4.3. 네트워크 확인
In-App Messaging은 인터넷 연결이 필요합니다:
- 시뮬레이터: Wi-Fi 또는 셀룰러 연결 확인
- 실제 기기: 인터넷 연결 확인

### 4.4. 앱 상태 확인
- 앱을 완전히 종료 후 재시작
- 기기 재부팅
- Firebase Console에서 캠페인을 비활성화 후 다시 활성화

## 5. 일반적인 문제 해결

### 문제 1: 메시지가 전혀 표시되지 않음

**가능한 원인**:
1. In-App Messaging이 제대로 설치되지 않음
2. 메시지가 아직 Published 상태가 아님
3. 이벤트 트리거가 발생하지 않음

**해결책**:
```objective-c
// AppDelegate.mm에 임시로 추가하여 테스트
[[FIRInAppMessaging inAppMessaging] triggerEvent:@"test_event"];
```

그리고 Firebase Console에서 "test_event"를 트리거로 사용하는 캠페인 생성.

### 문제 2: 시뮬레이터에서 작동하지 않음

시뮬레이터에서는 일부 In-App Messaging 기능이 제한될 수 있습니다. **실제 iOS 기기에서 테스트**하세요.

### 문제 3: 메시지가 한 번만 표시됨

Firebase In-App Messaging은 기본적으로 사용자당 한 번만 표시됩니다.

**해결책**:
Firebase Console > 캠페인 설정에서 Frequency capping 설정 확인

## 6. React Native Bridge 구현 (선택)

HomeScreen에서 포그라운드 진입을 감지하여 Native로 이벤트를 트리거하고 싶다면:

### 6.1. Native Module 추가

```objective-c
// ios/meditation_blossom/InAppMessagingModule.m
#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(InAppMessagingModule, NSObject)

RCT_EXTERN_METHOD(triggerEvent:(NSString *)eventName)

@end
```

```objective-c
// ios/meditation_blossom/InAppMessagingModule.m
#import <React/RCTBridgeModule.h>
#import <FirebaseInAppMessaging/FirebaseInAppMessaging.h>

@implementation RCT_EXTERN_MODULE(InAppMessagingModule, NSObject)

RCT_EXPORT_METHOD(triggerEvent:(NSString *)eventName) {
  [[FIRInAppMessaging inAppMessaging] triggerEvent:eventName];
}

@end
```

### 6.2. React Native에서 사용

```typescript
// src/types/InAppMessagingModule.ts
import { NativeModules } from 'react-native';
export default NativeModules.InAppMessagingModule;
```

```typescript
// src/screens/HomeScreen.tsx
import InAppMessagingModule from '../types/InAppMessagingModule';

useEffect(() => {
  const subscription = AppState.addEventListener('change', (nextAppState) => {
    if (nextAppState === 'active') {
      InAppMessagingModule?.triggerEvent('app_foreground');
    }
  });
  
  return () => subscription?.remove();
}, []);
```

## 7. 현재 권장 해결책

가장 간단한 방법은 **AppDelegate에서 수동 트리거**를 추가하는 것입니다:

```objective-c
// AppDelegate.mm의 didFinishLaunchingWithOptions 메서드에 추가
[FIRInAppMessaging inAppMessaging].messageDisplaySuppressed = NO;

// 테스트를 위해 명시적으로 이벤트 트리거
[[FIRInAppMessaging inAppMessaging] triggerEvent:@"app_foreground"];
```

그리고 Firebase Console에서 **"app_foreground" 이벤트를 트리거로 사용하는 캠페인**을 생성하세요.

## 8. 참고 자료

- [Firebase In-App Messaging iOS 문서](https://firebase.google.com/docs/in-app-messaging/ios)
- [In-App Messaging 베스트 프랙티스](https://firebase.google.com/docs/in-app-messaging/best-practices)
- [Analytics 이벤트 트리거](https://firebase.google.com/docs/in-app-messaging/ios#analytics_triggers)

