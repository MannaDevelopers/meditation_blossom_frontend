# iOS 앱 종료 상태에서 FCM 수신 가이드

## 문제 상황

iOS에서 앱이 **완전히 종료된 상태 (Terminated/Killed)**일 때, data-only FCM 메시지를 받지 못하는 경우가 있습니다.

### iOS의 제한 사항

1. **Silent Push 제한**: iOS는 배터리 절약을 위해 완전히 종료된 앱의 silent push (data-only, `content-available: 1`)를 **제한적으로 처리**합니다.
   - 특히 오래 실행되지 않은 앱은 더욱 제한됩니다
   - iOS는 사용자가 최근에 사용한 앱에만 silent push를 허용하는 경향이 있습니다

2. **Background App Refresh**: 사용자가 설정에서 Background App Refresh를 비활성화한 경우, silent push가 전혀 작동하지 않습니다.

3. **APNs Priority**: Background push는 `apns-priority: 5`를 사용해야 합니다. `10`은 notification을 위한 값입니다.

## 해결 방법

### 방법 1: Notification Payload 추가 (권장)

앱이 종료된 상태에서도 FCM을 받으려면, **notification payload를 포함**한 메시지를 보내야 합니다.

**장점**:
- 앱이 종료된 상태에서도 사용자에게 알림이 표시됩니다
- 사용자가 알림을 탭하면 앱이 실행되면서 데이터를 처리할 수 있습니다
- iOS의 제한을 우회할 수 있습니다

**단점**:
- 사용자에게 알림이 표시됩니다 (원하지 않는 경우 방해가 될 수 있음)

### 방법 2: 앱 실행 시 launchOptions에서 푸시 데이터 처리

앱이 푸시 알림으로 실행되었을 때, `didFinishLaunchingWithOptions`의 `launchOptions`에서 푸시 데이터를 처리할 수 있습니다.

### 방법 3: Background App Refresh 활성화 안내

사용자에게 Background App Refresh를 활성화하도록 안내할 수 있지만, 이것만으로는 완전히 해결되지 않습니다.

## 구현

### 1. test_fcm.js 수정: Notification 포함 메시지 추가

```javascript
// Notification을 포함한 메시지 (앱 종료 상태에서도 수신 가능)
async function sendNotificationMessage(topicName = 'sermon_events') {
  try {
    const message = {
      topic: topicName,
      notification: {
        title: '새로운 설교',
        body: '새로운 설교가 업데이트되었습니다.'
      },
      data: {
        topic: topicName,
        id: Date.now().toString(),
        title: '19. 하나님 예배하기(이것이 예배이다)',
        // ... 기타 데이터
      },
      apns: {
        payload: {
          aps: {
            'content-available': 1, // 백그라운드에서도 데이터 처리
            sound: 'default',
            badge: 1
          }
        },
        headers: {
          'apns-priority': '10' // Notification은 10 사용
        }
      }
    };
    // ...
  }
}
```

### 2. AppDelegate.mm 수정: launchOptions에서 푸시 데이터 처리

```objective-c
- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  // ...
  
  // 푸시 알림으로 앱이 실행된 경우 처리
  NSDictionary *remoteNotification = launchOptions[UIApplicationLaunchOptionsRemoteNotificationKey];
  if (remoteNotification) {
    NSLog(@"📱 App launched from remote notification");
    // 약간의 지연 후 처리 (Firebase 초기화 완료 대기)
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(1.0 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
      [self saveFcmSermon:remoteNotification];
    });
  }
  
  // ...
}
```

### 3. test_fcm.js의 sendDataOnlyMessage 수정: APNs Priority 수정

Background push는 `apns-priority: 5`를 사용해야 합니다.

## 권장 사항

1. **Notification 포함 메시지 사용**: 앱이 종료된 상태에서도 확실하게 수신하려면 notification payload를 포함한 메시지를 보내는 것이 가장 확실합니다.

2. **사용자 선택권 제공**: 
   - 설정에서 알림 표시 여부를 선택할 수 있도록 하거나
   - 중요한 업데이트만 알림으로 보내고, 나머지는 silent push로 처리

3. **앱 실행 시 최신 데이터 확인**: 앱이 실행될 때 항상 Firestore에서 최신 데이터를 확인하여, 놓친 FCM 메시지가 있어도 최신 데이터를 표시할 수 있습니다.

## 참고

- [Apple Developer: Pushing Background Updates to Your App](https://developer.apple.com/documentation/usernotifications/setting_up_a_remote_notification_server/pushing_background_updates_to_your_app)
- [Firebase: Send messages to iOS devices](https://firebase.google.com/docs/cloud-messaging/ios/send-message)

