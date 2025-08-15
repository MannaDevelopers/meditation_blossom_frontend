#import "AppDelegate.h"

#import <React/RCTBundleURLProvider.h>
#import <FirebaseCore/FirebaseCore.h>
#import <FirebaseMessaging/FirebaseMessaging.h>
#import <UserNotifications/UserNotifications.h>

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  [FIRApp configure];
  self.moduleName = @"meditation_blossom";
  // You can add your custom initial props in the dictionary below.
  // They will be passed down to the ViewController used by React Native.
  self.initialProps = @{};

  // FCM 설정
  [FIRMessaging messaging].delegate = self;
  
  // 알림 권한 요청
  UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter];
  center.delegate = self;
  [center requestAuthorizationWithOptions:(UNAuthorizationOptionAlert | UNAuthorizationOptionSound | UNAuthorizationOptionBadge)
                        completionHandler:^(BOOL granted, NSError * _Nullable error) {
    if (granted) {
      dispatch_async(dispatch_get_main_queue(), ^{
        [[UIApplication sharedApplication] registerForRemoteNotifications];
      });
    }
  }];

  return [super application:application didFinishLaunchingWithOptions:launchOptions];
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  return [self bundleURL];
}

- (NSURL *)bundleURL
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

#pragma mark - Firebase Messaging

- (void)messaging:(FIRMessaging *)messaging didReceiveRegistrationToken:(NSString *)fcmToken {
  NSLog(@"FCM registration token: %@", fcmToken);
  
  // sermon_events 토픽 구독
  [[FIRMessaging messaging] subscribeToTopic:@"sermon_events" completion:^(NSError * _Nullable error) {
    if (error) {
      NSLog(@"Failed to subscribe to sermon_events topic: %@", error);
    } else {
      NSLog(@"Successfully subscribed to sermon_events topic");
    }
  }];
}

- (void)application:(UIApplication *)application didRegisterForRemoteNotificationsWithDeviceToken:(NSData *)deviceToken {
  [FIRMessaging messaging].APNSToken = deviceToken;
}

// Data-only FCM 메시지 처리 (앱이 백그라운드에 있을 때)
- (void)application:(UIApplication *)application didReceiveRemoteNotification:(NSDictionary *)userInfo
fetchCompletionHandler:(void (^)(UIBackgroundFetchResult))completionHandler {
  NSLog(@"=== FCM DATA-ONLY MESSAGE RECEIVED (BACKGROUND) ===");
  NSLog(@"UserInfo: %@", userInfo);
  
  // sermon_events 토픽에서 온 메시지인지 확인
  NSString *topic = userInfo[@"topic"];
  NSString *from = userInfo[@"from"];
  
  if ([topic isEqualToString:@"sermon_events"] || [from containsString:@"sermon_events"]) {
    NSLog(@"Processing sermon_events data-only message in background");
    [self saveFcmSermon:userInfo];
    completionHandler(UIBackgroundFetchResultNewData);
  } else {
    NSLog(@"Message not from sermon_events topic, ignoring");
    completionHandler(UIBackgroundFetchResultNoData);
  }
}

// 설교 이벤트 처리 헬퍼 메서드
- (void)saveFcmSermon:(NSDictionary *)data {
  NSLog(@"=== PROCESSING SERMON EVENT ===");
  NSLog(@"Event data: %@", data);
  
  // TODO: AsyncStorage에 새로운 설교 데이터 저장 key 값은 "fcm_sermon" 으로 저장.
  
}

- (void)sendSermonUpdateEvent {
  NSLog(@"=== SENDING SERMON UPDATE EVENT ===");
  // TODO: React Native로 이벤트 전송 (앱이 포그라운드에 있을 때)
  // https://reactnative.dev/docs/legacy/native-modules-ios#sending-events-to-javascript
}

#pragma mark - UNUserNotificationCenterDelegate

- (void)userNotificationCenter:(UNUserNotificationCenter *)center
       willPresentNotification:(UNNotification *)notification
         withCompletionHandler:(void (^)(UNNotificationPresentationOptions))completionHandler {
  // 앱이 포그라운드에 있을 때 알림 표시
  completionHandler(UNNotificationPresentationOptionAlert | UNNotificationPresentationOptionSound);
}

- (void)userNotificationCenter:(UNUserNotificationCenter *)center
didReceiveNotificationResponse:(UNNotificationResponse *)response
         withCompletionHandler:(void(^)(void))completionHandler {
  // 알림을 탭했을 때 처리
  NSDictionary *userInfo = response.notification.request.content.userInfo;
  NSLog(@"=== FCM BACKGROUND NOTIFICATION TAPPED ===");
  NSLog(@"UserInfo: %@", userInfo);
  NSLog(@"Notification title: %@", response.notification.request.content.title);
  NSLog(@"Notification body: %@", response.notification.request.content.body);
  NSLog(@"Notification identifier: %@", response.notification.request.identifier);
  completionHandler();
}

@end
