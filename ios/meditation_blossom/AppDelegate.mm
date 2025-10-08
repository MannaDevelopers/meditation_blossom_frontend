#import "AppDelegate.h"

#import <React/RCTBundleURLProvider.h>
#import <FirebaseCore/FirebaseCore.h>
#import <FirebaseMessaging/FirebaseMessaging.h>
#import <UserNotifications/UserNotifications.h>
#import <UserNotifications/UserNotifications.h>

// MyEventModule 클래스 선언
@interface MyEventModule : NSObject
- (void)trigger:(NSString *)message;
@end

@interface AppDelegate () <UNUserNotificationCenterDelegate, FIRMessagingDelegate>
@end

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
  
  UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter];
  center.delegate = self;
  
  UNAuthorizationOptions options = UNAuthorizationOptionAlert | UNAuthorizationOptionSound | UNAuthorizationOptionBadge;

  [center requestAuthorizationWithOptions:(UNAuthorizationOptionAlert | UNAuthorizationOptionSound | UNAuthorizationOptionBadge)
                        completionHandler:^(BOOL granted, NSError * _Nullable error) {
    if (granted) {
      NSLog(@"알림 권한 부여");
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
  // 토픽 구독은 APNS 토큰을 받은 후 didRegisterForRemoteNotificationsWithDeviceToken에서 수행
}

// 앱이 포그라운드에 있을 때 FCM 메시지 수신
- (void)application:(UIApplication *)application didReceiveRemoteNotification:(NSDictionary *)userInfo {
  NSLog(@"=== FCM MESSAGE RECEIVED (FOREGROUND) ===");
  NSLog(@"UserInfo: %@", userInfo);
  
  // sermon_events 또는 sermon_events_test 토픽에서 온 메시지인지 확인
  NSString *topic = userInfo[@"topic"];
  NSString *from = userInfo[@"from"];
  
  NSLog(@"Topic from data: %@", topic);
  NSLog(@"From: %@", from);
  
  BOOL isSermonEventsTopic = NO;
  BOOL isTestTopic = NO;
  
  // data 필드의 topic을 먼저 확인
  if (topic) {
    if ([topic isEqualToString:@"sermon_events_test"]) {
      isTestTopic = YES;
    } else if ([topic isEqualToString:@"sermon_events"]) {
      isSermonEventsTopic = YES;
    }
  }
  
  // topic이 없으면 from 필드 확인
  if (!isSermonEventsTopic && !isTestTopic && from) {
    if ([from containsString:@"sermon_events_test"]) {
      isTestTopic = YES;
    } else if ([from containsString:@"sermon_events"]) {
      isSermonEventsTopic = YES;
    }
  }
  
  if (isSermonEventsTopic || isTestTopic) {
    NSString *topicName = isTestTopic ? @"sermon_events_test" : @"sermon_events";
    NSLog(@"✅ Processing %@ message in foreground", topicName);
    [self saveFcmSermon:userInfo];
  } else {
    NSLog(@"❌ Message not from sermon_events or sermon_events_test topic");
  }
}

- (void)application:(UIApplication *)application didRegisterForRemoteNotificationsWithDeviceToken:(NSData *)deviceToken {
  NSLog(@"APNS device token received");
  [FIRMessaging messaging].APNSToken = deviceToken;
  
  // APNS 토큰을 받은 후 토픽 구독
  [[FIRMessaging messaging] subscribeToTopic:@"sermon_events" completion:^(NSError * _Nullable error) {
    if (error) {
      NSLog(@"Failed to subscribe to sermon_events topic: %@", error);
    } else {
      NSLog(@"Successfully subscribed to sermon_events topic");
    }
  }];
  
  [[FIRMessaging messaging] subscribeToTopic:@"sermon_events_test" completion:^(NSError * _Nullable error) {
    if (error) {
      NSLog(@"Failed to subscribe to sermon_events_test topic: %@", error);
    } else {
      NSLog(@"Successfully subscribed to sermon_events_test topic");
    }
  }];
}

// Data-only FCM 메시지 처리 (앱이 백그라운드에 있을 때)
- (void)application:(UIApplication *)application didReceiveRemoteNotification:(NSDictionary *)userInfo
fetchCompletionHandler:(void (^)(UIBackgroundFetchResult))completionHandler {
  NSLog(@"=== FCM DATA-ONLY MESSAGE RECEIVED (BACKGROUND) ===");
  NSLog(@"UserInfo: %@", userInfo);
  
  // sermon_events 또는 sermon_events_test 토픽에서 온 메시지인지 확인
  NSString *topic = userInfo[@"topic"]; // data 필드에 포함된 topic
  NSString *from = userInfo[@"from"];
  NSString *gcmMessageId = userInfo[@"gcm.message_id"];
  
  NSLog(@"Topic from data: %@", topic);
  NSLog(@"From: %@", from);
  NSLog(@"GCM Message ID: %@", gcmMessageId);
  
  BOOL isSermonEventsTopic = NO;
  BOOL isTestTopic = NO;
  
  // data 필드의 topic을 먼저 확인
  if (topic) {
    if ([topic isEqualToString:@"sermon_events_test"]) {
      isTestTopic = YES;
    } else if ([topic isEqualToString:@"sermon_events"]) {
      isSermonEventsTopic = YES;
    }
  }
  
  // topic이 없으면 from 필드 확인
  if (!isSermonEventsTopic && !isTestTopic && from) {
    if ([from containsString:@"sermon_events_test"]) {
      isTestTopic = YES;
    } else if ([from containsString:@"sermon_events"]) {
      isSermonEventsTopic = YES;
    }
  }
  
  if (isSermonEventsTopic || isTestTopic) {
    NSString *topicName = isTestTopic ? @"sermon_events_test" : @"sermon_events";
    NSLog(@"✅ Processing %@ data-only message in background", topicName);
    [self saveFcmSermon:userInfo];
    completionHandler(UIBackgroundFetchResultNewData);
  } else {
    NSLog(@"❌ Message not from sermon_events or sermon_events_test topic");
    NSLog(@"Topic field: %@", topic);
    NSLog(@"From field: %@", from);
    completionHandler(UIBackgroundFetchResultNoData);
  }
}

// 설교 이벤트 처리 헬퍼 메서드
- (void)saveFcmSermon:(NSDictionary *)data {
  NSLog(@"=== PROCESSING SERMON EVENT ===");
  NSLog(@"Event data: %@", data);
  
  // id가 없으면 gcm.message_id를 사용
  NSString *sermonId = data[@"id"];
  if (!sermonId) {
    id messageId = data[@"gcm.message_id"];
    sermonId = [NSString stringWithFormat:@"%@", messageId];
  }
  
  // AsyncStorage에 새로운 설교 데이터 저장
  NSDictionary *sermonData = @{
    @"id": sermonId ?: @"",
    @"title": data[@"title"] ?: @"",
    @"content": data[@"content"] ?: @"",
    @"date": data[@"date"] ?: @"",
    @"category": data[@"category"] ?: [NSNull null],
    @"dayOfWeek": data[@"day_of_week"] ?: @"",
    @"createdAt": data[@"created_at"] ?: [NSNull null],
    @"updatedAt": data[@"updated_at"] ?: [NSNull null]
  };
  
  NSError *error;
  NSData *jsonData = [NSJSONSerialization dataWithJSONObject:sermonData options:0 error:&error];
  if (jsonData) {
    NSString *jsonString = [[NSString alloc] initWithData:jsonData encoding:NSUTF8StringEncoding];
    
    // 1. App Group에 저장 (위젯용)
    NSUserDefaults *sharedDefaults = [[NSUserDefaults alloc] initWithSuiteName:@"group.org.mannamethodistchurch.mannadev.meditationblossom"];
    [sharedDefaults setObject:jsonString forKey:@"fcm_sermon"];
    [sharedDefaults setObject:jsonString forKey:@"displaySermon"];
    [sharedDefaults synchronize];
    
    NSLog(@"✅ Successfully saved FCM sermon to App Group");
    
    // React Native로 이벤트 전송
    [self sendSermonUpdateEvent];
  } else {
    NSLog(@"Failed to serialize sermon data: %@", error);
  }
}

- (void)sendSermonUpdateEvent {
  NSLog(@"=== SENDING SERMON UPDATE EVENT ===");
  
  // 앱 상태 확인
  UIApplicationState state = [[UIApplication sharedApplication] applicationState];
  
  if (state == UIApplicationStateActive) {
    // 앱이 포그라운드에 있을 때 이벤트 전송
    NSLog(@"App is in foreground, sending event to React Native");
    
    // 방법 1: MyEventModule 사용 (Bridge가 있을 때)
    if (self.bridge) {
      MyEventModule *eventModule = [self.bridge moduleForClass:[MyEventModule class]];
      if (eventModule) {
        [eventModule trigger:@"New sermon received from FCM"];
        NSLog(@"✅ Successfully sent ON_SERMON_UPDATE event to React Native via MyEventModule");
        return;
      } else {
        NSLog(@"⚠️ MyEventModule not found, trying NSNotificationCenter");
      }
    } else {
      NSLog(@"⚠️ Bridge not available, trying NSNotificationCenter");
    }
    
    // 방법 2: NSNotificationCenter 사용 (Bridge가 없을 때)
    [[NSNotificationCenter defaultCenter] postNotificationName:@"FCM_SERMON_UPDATE" object:nil];
    NSLog(@"✅ Posted FCM_SERMON_UPDATE notification via NSNotificationCenter");
  } else {
    // 앱이 백그라운드에 있을 때는 이벤트를 저장만 하고 전송하지 않음
    // React Native 앱이 다시 시작될 때 자동으로 로컬 데이터를 로드함
    NSLog(@"ℹ️ App is in background, event will be processed when app becomes active");
  }
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
