#import "AppDelegate.h"

#import <React/RCTBundleURLProvider.h>
#import <FirebaseCore/FirebaseCore.h>
#import <FirebaseMessaging/FirebaseMessaging.h>
#import <FirebaseInAppMessaging/FirebaseInAppMessaging.h>
#import <UserNotifications/UserNotifications.h>
#import <WidgetKit/WidgetKit.h>
// 디버깅용 imports (테스트 완료 후 주석 처리)
// #import <FirebaseAnalytics/FirebaseAnalytics.h>
// #import <FirebaseInstallations/FirebaseInstallations.h>

// MyEventModule 클래스 선언
@interface MyEventModule : NSObject
- (void)trigger:(NSString *)message;
@end

// WidgetUpdateModule 클래스 선언
@interface WidgetUpdateModule : NSObject
+ (void)reloadWidgets;
@end

@interface AppDelegate () <UNUserNotificationCenterDelegate, FIRMessagingDelegate>
@end

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  // Network connection logging 억제
  [[NSUserDefaults standardUserDefaults] setBool:NO forKey:@"NSURLSessionVerboseLogging"];
  
  [FIRApp configure];
  self.moduleName = @"meditation_blossom";
  // You can add your custom initial props in the dictionary below.
  // They will be passed down to the ViewController used by React Native.
  self.initialProps = @{};

  // Firebase In-App Messaging 설정
  // In-App Messaging은 자동으로 초기화되며, 별도의 delegate 설정이 필요 없습니다
  [FIRInAppMessaging inAppMessaging].messageDisplaySuppressed = NO;
  // Enable debug mode for In-App Messaging
  [FIRInAppMessaging inAppMessaging].automaticDataCollectionEnabled = YES;
  
  // FCM 설정
  [FIRMessaging messaging].delegate = self;
  
  /* 디버깅용 로그 (테스트 완료 후 주석 처리)
  NSLog(@"Firebase In-App Messaging initialized");
  NSLog(@"AppDelegate initialization complete");
  
  // Installation ID 로그 출력
  [[FIRInstallations installations] installationIDWithCompletion:^(NSString * _Nullable identifier, NSError * _Nullable error) {
    if (error) {
      NSLog(@"❌ Failed to get installation ID: %@", error);
    } else {
      NSLog(@"✅ Installation ID: %@", identifier);
    }
  }];
  
  // 추가 디버깅 로그
  NSLog(@"In-App Messaging settings: suppressed=%@, dataCollection=%@", 
        @([FIRInAppMessaging inAppMessaging].messageDisplaySuppressed), 
        @([FIRInAppMessaging inAppMessaging].automaticDataCollectionEnabled));
  
  // 앱 시작 시 이벤트 트리거 (5초 후 재시도 포함)
  NSLog(@"🔥 Triggering app_foreground event...");
  [[FIRInAppMessaging inAppMessaging] triggerEvent:@"app_foreground"];
  NSLog(@"✅ app_foreground event triggered");
  
  // 5초 후 재시도 (네트워크 지연 대응)
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(5.0 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
    NSLog(@"🔥 Retrying app_foreground event trigger (5 seconds later)...");
    [[FIRInAppMessaging inAppMessaging] triggerEvent:@"app_foreground"];
    NSLog(@"✅ app_foreground retry complete");
  });
  */
  
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
  NSLog(@"=== FCM MESSAGE RECEIVED (FOREGROUND) - didReceiveRemoteNotification ===");
  NSLog(@"UserInfo: %@", userInfo);
  NSLog(@"All keys in UserInfo: %@", [userInfo allKeys]);
  
  // sermon_events 또는 sermon_events_test 토픽에서 온 메시지인지 확인
  NSString *topic = userInfo[@"topic"];
  NSString *from = userInfo[@"from"];
  
  NSLog(@"Topic from data: %@", topic);
  NSLog(@"From: %@", from);
  
  BOOL isSermonEventsTopic = NO;
  BOOL isTestTopic = NO;
  
  // data 필드의 topic을 먼저 확인
  if (topic) {
    if ([topic isEqualToString:@"sermon_events"]) {
      isSermonEventsTopic = YES;
    }
#ifdef DEBUG
    // DEBUG 모드에서만 sermon_events_test 처리
    else if ([topic isEqualToString:@"sermon_events_test"]) {
      isTestTopic = YES;
    }
#endif
  }
  
  // topic이 없으면 from 필드 확인
  if (!isSermonEventsTopic && !isTestTopic && from) {
    if ([from containsString:@"sermon_events"]) {
      isSermonEventsTopic = YES;
    }
#ifdef DEBUG
    // DEBUG 모드에서만 sermon_events_test 처리
    else if ([from containsString:@"sermon_events_test"]) {
      isTestTopic = YES;
    }
#endif
  }
  
  if (isSermonEventsTopic || isTestTopic) {
    NSString *topicName = isTestTopic ? @"sermon_events_test" : @"sermon_events";
    NSLog(@"✅ Processing %@ message in foreground", topicName);
    [self saveFcmSermon:userInfo];
  } else {
    NSLog(@"❌ Message not from sermon_events%@ topic", @""
#ifdef DEBUG
          @" or sermon_events_test"
#endif
    );
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
  
  // DEBUG 모드에서만 sermon_events_test 토픽 구독
#ifdef DEBUG
  [[FIRMessaging messaging] subscribeToTopic:@"sermon_events_test" completion:^(NSError * _Nullable error) {
    if (error) {
      NSLog(@"[DEBUG] Failed to subscribe to sermon_events_test topic: %@", error);
    } else {
      NSLog(@"[DEBUG] Successfully subscribed to sermon_events_test topic");
    }
  }];
#endif
}

// Data-only FCM 메시지 처리 (앱이 백그라운드에 있을 때)
- (void)application:(UIApplication *)application didReceiveRemoteNotification:(NSDictionary *)userInfo
fetchCompletionHandler:(void (^)(UIBackgroundFetchResult))completionHandler {
  NSLog(@"=== FCM MESSAGE RECEIVED (BACKGROUND) - didReceiveRemoteNotification:fetchCompletionHandler ===");
  NSLog(@"UserInfo: %@", userInfo);
  NSLog(@"All keys in UserInfo: %@", [userInfo allKeys]);
  
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
    if ([topic isEqualToString:@"sermon_events"]) {
      isSermonEventsTopic = YES;
    }
#ifdef DEBUG
    // DEBUG 모드에서만 sermon_events_test 처리
    else if ([topic isEqualToString:@"sermon_events_test"]) {
      isTestTopic = YES;
    }
#endif
  }
  
  // topic이 없으면 from 필드 확인
  if (!isSermonEventsTopic && !isTestTopic && from) {
    if ([from containsString:@"sermon_events"]) {
      isSermonEventsTopic = YES;
    }
#ifdef DEBUG
    // DEBUG 모드에서만 sermon_events_test 처리
    else if ([from containsString:@"sermon_events_test"]) {
      isTestTopic = YES;
    }
#endif
  }
  
  if (isSermonEventsTopic || isTestTopic) {
    NSString *topicName = isTestTopic ? @"sermon_events_test" : @"sermon_events";
    NSLog(@"✅ Processing %@ data-only message in background", topicName);
    [self saveFcmSermon:userInfo];
    completionHandler(UIBackgroundFetchResultNewData);
  } else {
    NSLog(@"❌ Message not from sermon_events%@ topic", @""
#ifdef DEBUG
          @" or sermon_events_test"
#endif
    );
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
  
  // content 필드 확인 및 로깅
  NSString *contentValue = data[@"content"];
  NSLog(@"📝 Content length: %lu characters", (unsigned long)[contentValue length]);
  NSLog(@"📝 Content preview (first 200 chars): %@", [contentValue substringToIndex:MIN(200, [contentValue length])]);
  
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
    
    // JSON 문자열의 content 확인
    NSLog(@"📝 JSON string length: %lu characters", (unsigned long)[jsonString length]);
    
    // 1. App Group에 저장 (위젯용)
    NSUserDefaults *sharedDefaults = [[NSUserDefaults alloc] initWithSuiteName:@"group.org.mannamethodistchurch.mannadev.meditationblossom"];
    [sharedDefaults setObject:jsonString forKey:@"fcm_sermon"];
    [sharedDefaults setObject:jsonString forKey:@"displaySermon"];
    [sharedDefaults synchronize];
    
    // 저장된 데이터 확인
    NSString *savedData = [sharedDefaults stringForKey:@"fcm_sermon"];
    NSLog(@"📝 Saved data length in UserDefaults: %lu characters", (unsigned long)[savedData length]);
    NSLog(@"✅ Successfully saved FCM sermon to App Group");
    
    // 2. 위젯 즉시 업데이트 (Swift 모듈 사용)
    [WidgetUpdateModule reloadWidgets];
    
    // 3. React Native로 이벤트 전송
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
