#import "AppDelegate.h"

#import <React/RCTBundleURLProvider.h>
#import <React/RCTBridge.h>
#import <React/RCTRootView.h>
#import <React/RCTLog.h>
#import <React/RCTUtils.h>
#import <FirebaseCore/FirebaseCore.h>
#import <FirebaseMessaging/FirebaseMessaging.h>
#import <FirebaseInAppMessaging/FirebaseInAppMessaging.h>
#import <FirebaseAnalytics/FirebaseAnalytics.h>
#import <UserNotifications/UserNotifications.h>
#import <WidgetKit/WidgetKit.h>
#import <ifaddrs.h>
#import <arpa/inet.h>
#import <string.h>

// Hermes 엔진 확인을 위한 헤더
#if __has_include(<hermes/hermes.h>)
#import <hermes/hermes.h>
#import <hermes/hermes.h>
#define HERMES_AVAILABLE 1
#else
#define HERMES_AVAILABLE 0
#endif

#import "SermonBuilder.h"
#import "meditation_blossom-Swift.h"

// MyEventModule 클래스 선언
@interface MyEventModule : NSObject
- (void)trigger:(NSString *)message;
- (void)triggerQtUpdate:(NSString *)message;
@end

@interface AppDelegate () <UNUserNotificationCenterDelegate, FIRMessagingDelegate>
@end

static NSString *MBAsyncStorageDirectory(void)
{
  NSString *appSupportDir = NSSearchPathForDirectoriesInDomains(
      NSApplicationSupportDirectory, NSUserDomainMask, YES).firstObject;
  NSString *bundleId = [[NSBundle mainBundle] bundleIdentifier];
  return [[appSupportDir stringByAppendingPathComponent:bundleId]
      stringByAppendingPathComponent:@"RCTAsyncLocalStorage_V1"];
}

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  NSLog(@"🎯 ========================================");
  NSLog(@"🎯 AppDelegate: didFinishLaunchingWithOptions");
  NSLog(@"🎯 App launch options: %@", launchOptions);
  
  // 1. 네이티브 모듈(AsyncStorage 등) 초기화 완료 이벤트를 감지할 리스너 등록
  [[NSNotificationCenter defaultCenter] addObserver:self
                                           selector:@selector(handleJavaScriptDidLoad:)
                                               name:RCTJavaScriptDidLoadNotification
                                             object:nil];
  
  // 2. Extension 설치 확인
  NSBundle *mainBundle = [NSBundle mainBundle];
  NSURL *appBundleURL = [mainBundle bundleURL];
  NSURL *pluginsURL = [appBundleURL URLByAppendingPathComponent:@"PlugIns" isDirectory:YES];
  NSFileManager *fileManager = [NSFileManager defaultManager];
  
  if ([fileManager fileExistsAtPath:[pluginsURL path]]) {
    NSLog(@"🔍 Checking installed app extensions...");
    NSError *error = nil;
    NSArray *plugins = [fileManager contentsOfDirectoryAtURL:pluginsURL includingPropertiesForKeys:nil options:0 error:&error];
    if (plugins) {
      NSLog(@"   - Found %lu extension(s) in PlugIns directory", (unsigned long)[plugins count]);
      for (NSURL *pluginURL in plugins) {
        NSString *pluginName = [pluginURL lastPathComponent];
        if ([pluginName containsString:@"PushNotificationService"] || [pluginName containsString:@"MeditationBlossomWidgetExtension"]) {
          NSLog(@"     ✅ Extension installed: %@", pluginName);
        }
      }
    }
  } else {
    NSLog(@"❌ PlugIns directory does not exist - no extensions are embedded!");
  }
  
  // 디버깅용 로그 활성화
  [[NSUserDefaults standardUserDefaults] setBool:YES forKey:@"NSURLSessionVerboseLogging"];
  
  // 3. Firebase 및 FCM 초기화
  [FIRApp configure];
  self.moduleName = @"meditation_blossom";
  self.initialProps = @{};

  [FIRInAppMessaging inAppMessaging].messageDisplaySuppressed = NO;
  [FIRInAppMessaging inAppMessaging].automaticDataCollectionEnabled = YES;
  [FIRMessaging messaging].delegate = self;
  
  // 4. 알림 권한 요청
  UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter];
  center.delegate = self;
  [center requestAuthorizationWithOptions:(UNAuthorizationOptionAlert | UNAuthorizationOptionSound | UNAuthorizationOptionBadge)
                        completionHandler:^(BOOL granted, NSError * _Nullable error) {
    if (granted) {
      NSLog(@"✅ 알림 권한 부여 완료");
      dispatch_async(dispatch_get_main_queue(), ^{
        [[UIApplication sharedApplication] registerForRemoteNotifications];
      });
    }
  }];

  // 5. 부모 클래스 호출을 통해 React Native 내부 Core 초기화 시작
  BOOL result = [super application:application didFinishLaunchingWithOptions:launchOptions];
  
  // React Native 로그 레벨 설정 (디버깅용)
  RCTSetLogThreshold(RCTLogLevelInfo);
  
#if DEBUG
  NSLog(@"📁 AsyncStorage path: %@", MBAsyncStorageDirectory());
#endif
  
  return result;
}

#pragma mark - React Native Notification Handlers

// 6. 모든 네이티브 모듈이 준비되었을 때 실행되는 콜백
- (void)handleJavaScriptDidLoad:(NSNotification *)notification {
  NSLog(@"✅ [Notification] JavaScript bundle loaded successfully!");
  
  RCTBridge *activeBridge = notification.object;
  if (activeBridge && activeBridge.valid) {
    NSLog(@"✅ Bridge is valid and ready. Checking widgets...");
    [self checkWidgetKitPushDataAndReloadWidgets];
  }
}

// 객체 소멸 시 알림 리스너 해제
- (void)dealloc {
  [[NSNotificationCenter defaultCenter] removeObserver:self];
}

#pragma mark - AsyncStorage Storage Helper

// Bridgeless 환경에서 JS bridge에 의존하지 않고 AsyncStorage 파일에 직접 저장
- (void)saveToAsyncStorageDirect:(NSString *)jsonString forKey:(NSString *)key {
  NSLog(@"🚀 saveToAsyncStorageDirect called");
  
  if (!jsonString || !key) {
    NSLog(@"❌ AsyncStorage save skipped: key or value is nil");
    return;
  }

  NSString *storageDir = MBAsyncStorageDirectory();
  NSString *manifestPath = [storageDir stringByAppendingPathComponent:@"manifest.json"];

  NSFileManager *fm = [NSFileManager defaultManager];
  NSError *dirError = nil;
  if (![fm fileExistsAtPath:storageDir]) {
    [fm createDirectoryAtPath:storageDir
  withIntermediateDirectories:YES
                   attributes:nil
                        error:&dirError];
    if (dirError) {
      NSLog(@"❌ Failed to create storage dir: %@", dirError.localizedDescription);
      return;
    }
  }

  // manifest 읽기
  NSMutableDictionary *manifest = [NSMutableDictionary dictionary];
  if ([fm fileExistsAtPath:manifestPath]) {
    NSData *data = [NSData dataWithContentsOfFile:manifestPath];
    if (data) {
      NSError *parseError = nil;
      NSDictionary *existing = [NSJSONSerialization JSONObjectWithData:data
                                                               options:0
                                                                 error:&parseError];
      if (existing && !parseError) {
        [manifest addEntriesFromDictionary:existing];
      }
    }
  }

  // ✅ 저장 전 현재 manifest 내용 출력
  NSLog(@"===== 저장 전 AsyncStorage 현황 =====");
  if (manifest.count == 0) {
    NSLog(@"   (비어 있음)");
  } else {
    [manifest enumerateKeysAndObjectsUsingBlock:^(NSString *k, id v, BOOL *stop) {
      if ([v isKindOfClass:[NSNull class]]) {
        // 별도 파일에 저장된 큰 값 → 파일 읽어서 출력
        NSString *hashedKey = RCTMD5Hash(k);
        NSString *valuePath = [storageDir stringByAppendingPathComponent:hashedKey];
        NSString *fileValue = [NSString stringWithContentsOfFile:valuePath
                                                        encoding:NSUTF8StringEncoding
                                                           error:nil];
        NSLog(@"   [FILE] key: %@", k);
        NSLog(@"          val: %@", fileValue ?: @"(읽기 실패)");
      } else {
        NSLog(@"   [INLINE] key: %@", k);
        NSLog(@"            val: %@", v);
      }
    }];
  }
  NSLog(@"========================================");

  // upsert
  static const NSUInteger kInlineValueThreshold = 1024;

  if (jsonString.length <= kInlineValueThreshold) {
    manifest[key] = jsonString;
  } else {
    NSString *hashedKey = RCTMD5Hash(key);
    NSString *valuePath = [storageDir stringByAppendingPathComponent:hashedKey];
    NSError *writeError = nil;
    [jsonString writeToFile:valuePath
                 atomically:YES
                   encoding:NSUTF8StringEncoding
                      error:&writeError];
    if (writeError) {
      NSLog(@"❌ Failed to write value file: %@", writeError.localizedDescription);
      return;
    }
    manifest[key] = [NSNull null];
  }

  // manifest.json 쓰기
  NSError *jsonError = nil;
  NSData *manifestData = [NSJSONSerialization dataWithJSONObject:manifest
                                                         options:0
                                                           error:&jsonError];
  if (jsonError || !manifestData) {
    NSLog(@"❌ Failed to serialize manifest: %@", jsonError.localizedDescription);
    return;
  }

  NSError *writeError = nil;
  [manifestData writeToFile:manifestPath options:NSDataWritingAtomic error:&writeError];
  if (writeError) {
    NSLog(@"❌ Failed to write manifest: %@", writeError.localizedDescription);
  } else {
    NSLog(@"✅ manifest.json write success for key: %@", key);
  }
}

#pragma mark - Bundle URL & Debugging (유지됨)

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  NSURL *url = [self bundleURL];
  NSLog(@"🌉 Bridge requesting bundle URL: %@", url);
  return url;
}

- (NSURL *)bundleURL
{
#if DEBUG
  NSString *bundleRoot = @"index";
  NSUserDefaults *sharedDefaults = [[NSUserDefaults alloc] initWithSuiteName:@"group.mannachurch.meditationblossom"];
  BOOL hasWidgetKitData = NO;
  if (sharedDefaults) {
    NSString *displaySermon = [sharedDefaults stringForKey:@"displaySermon"];
    NSString *fcmSermon = [sharedDefaults stringForKey:@"fcm_sermon"];
    hasWidgetKitData = (displaySermon != nil || fcmSermon != nil);
  }
  
  if (hasWidgetKitData) {
    NSLog(@"⚠️ WidgetKit push data detected - using local bundle to avoid Metro connection issues");
    NSURL *localBundle = [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
    if (localBundle) return localBundle;
    NSLog(@"⚠️ Local bundle not found - falling back to Metro URL");
  }
  
  NSURL *metroURL = [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:bundleRoot];
  if (metroURL && [metroURL.scheme isEqualToString:@"http"]) {
    return metroURL;
  }
  
  NSString *jsLocation = @"172.30.1.25";
  NSNumber *port = @8081;
  NSString *urlString = [NSString stringWithFormat:@"http://%@:%@/%@.bundle?platform=ios&dev=true&minify=false",
                         jsLocation, port, bundleRoot];
  NSURL *directURL = [NSURL URLWithString:urlString];
  
  if (directURL == nil) {
    NSLog(@"❌ All Metro bundle URL attempts failed! Using local bundle...");
    return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
  }
  
  return directURL;
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

- (NSArray<NSString *> *)getIPAddresses
{
  NSMutableArray *addresses = [NSMutableArray array];
  struct ifaddrs *interfaces = NULL;
  struct ifaddrs *temp_addr = NULL;
  int success = 0;
  
  success = getifaddrs(&interfaces);
  if (success == 0) {
    temp_addr = interfaces;
    while(temp_addr != NULL) {
      if(temp_addr->ifa_addr->sa_family == AF_INET) {
        NSString *interfaceName = [NSString stringWithUTF8String:temp_addr->ifa_name];
        if ([interfaceName isEqualToString:@"en0"] || [interfaceName hasPrefix:@"en"]) {
          NSString *address = [NSString stringWithUTF8String:inet_ntoa(((struct sockaddr_in *)temp_addr->ifa_addr)->sin_addr)];
          if (![address isEqualToString:@"127.0.0.1"] && ![address hasPrefix:@"169.254"]) {
            [addresses addObject:address];
          }
        }
      }
      temp_addr = temp_addr->ifa_next;
    }
  }
  freeifaddrs(interfaces);
  return addresses;
}

#pragma mark - Firebase Messaging

- (void)messaging:(FIRMessaging *)messaging didReceiveRegistrationToken:(NSString *)fcmToken {
  NSLog(@"🔥 FCM registration token: %@", fcmToken);
}

// 앱이 포그라운드에 있을 때 FCM 메시지 수신
- (void)application:(UIApplication *)application didReceiveRemoteNotification:(NSDictionary *)userInfo {
  NSLog(@"=== FCM MESSAGE RECEIVED (FOREGROUND) ===");
  
  NSDictionary *widgetkit = userInfo[@"widgetkit"];
  if (!widgetkit) {
    NSDictionary *aps = userInfo[@"aps"];
    if (aps) widgetkit = aps[@"widgetkit"];
  }
  if (!widgetkit) {
    NSDictionary *data = userInfo[@"data"];
    if (data) widgetkit = data[@"widgetkit"];
  }
  
  if (widgetkit && [widgetkit[@"kind"] isEqualToString:@"MeditationBlossomWidget"]) {
    NSLog(@"🎯 WidgetKit Push Notification detected in foreground");
    NSDictionary *widgetkitData = widgetkit[@"data"];
    if (widgetkitData) {
      [self saveFcmSermon:widgetkitData];
      return;
    }
  }
  
  NSString *topic = userInfo[@"topic"];
  NSString *from = userInfo[@"from"];
  BOOL isTestTopic = NO;
  if ([self isRecognizedTopic:topic from:from isTestTopic:&isTestTopic]) {
    [self saveFcmSermon:userInfo];
  }
}

- (void)application:(UIApplication *)application didRegisterForRemoteNotificationsWithDeviceToken:(NSData *)deviceToken {
  NSLog(@"🔥 APNS device token received");
  [FIRMessaging messaging].APNSToken = deviceToken;
  
  [[FIRMessaging messaging] subscribeToTopic:@"sermon_events" completion:nil];
  [[FIRMessaging messaging] subscribeToTopic:@"sermon_events_v2" completion:nil];
  [[FIRMessaging messaging] subscribeToTopic:@"qt_events" completion:nil];
  
#ifdef DEBUG
  [[FIRMessaging messaging] subscribeToTopic:@"sermon_events_test" completion:nil];
  [[FIRMessaging messaging] subscribeToTopic:@"qt_events_test" completion:nil];
#endif
}

// Data-only FCM 메시지 처리 (백그라운드)
- (void)application:(UIApplication *)application didReceiveRemoteNotification:(NSDictionary *)userInfo
fetchCompletionHandler:(void (^)(UIBackgroundFetchResult))completionHandler {
  NSLog(@"=== FCM MESSAGE RECEIVED (BACKGROUND) ===");
  
  NSDictionary *widgetkit = userInfo[@"widgetkit"];
  if (!widgetkit) {
    NSDictionary *aps = userInfo[@"aps"];
    if (aps) widgetkit = aps[@"widgetkit"];
  }
  if (!widgetkit) {
    NSDictionary *data = userInfo[@"data"];
    if (data) widgetkit = data[@"widgetkit"];
  }
  
  if (widgetkit && [widgetkit[@"kind"] isEqualToString:@"MeditationBlossomWidget"]) {
    NSDictionary *widgetkitData = widgetkit[@"data"];
    if (widgetkitData) {
      [self saveFcmSermon:widgetkitData];
      completionHandler(UIBackgroundFetchResultNewData);
      return;
    }
  }
  
  NSString *topic = userInfo[@"topic"];
  NSString *from = userInfo[@"from"];
  BOOL isTestTopic = NO;
  if ([self isRecognizedTopic:topic from:from isTestTopic:&isTestTopic]) {
    [self saveFcmSermon:userInfo];
    completionHandler(UIBackgroundFetchResultNewData);
  } else {
    completionHandler(UIBackgroundFetchResultNoData);
  }
}

#pragma mark - Payload Parsing & Storage Logic

- (BOOL)isSermonStorageKey:(NSString *)storageKey {
  return [storageKey isEqualToString:@"fcm_sermon"];
}

- (BOOL)isRecognizedTopic:(NSString *)topic from:(NSString *)from isTestTopic:(BOOL *)isTestTopic {
  if (isTestTopic) *isTestTopic = NO;
  NSString *normalizedTopic = [NSString stringWithFormat:@"%@", topic ?: @""].lowercaseString;
  NSString *normalizedFrom = [NSString stringWithFormat:@"%@", from ?: @""].lowercaseString;

  NSArray<NSString *> *productionTopics = @[@"sermon_events", @"qt_events", @"sermon_events_v2"];
  for (NSString *candidate in productionTopics) {
    if ([normalizedTopic isEqualToString:candidate] || [normalizedFrom containsString:candidate]) {
      return YES;
    }
  }

#ifdef DEBUG
  NSArray<NSString *> *testTopics = @[@"sermon_events_test", @"qt_events_test"];
  for (NSString *candidate in testTopics) {
    if ([normalizedTopic isEqualToString:candidate] || [normalizedFrom containsString:candidate]) {
      if (isTestTopic) *isTestTopic = YES;
      return YES;
    }
  }
#endif

  return NO;
}

- (NSString *)asyncStorageKeyForFCMData:(NSDictionary *)data {
  NSString *topic = [NSString stringWithFormat:@"%@", data[@"topic"] ?: @""].lowercaseString;
  if ([topic containsString:@"qt"]) return @"fcm_qt";
  if ([topic containsString:@"sermon"]) return @"fcm_sermon";
  return nil;
}

- (NSInteger)integerValueFromObject:(id)value defaultValue:(NSInteger)defaultValue {
  if ([value isKindOfClass:[NSNumber class]]) return [value integerValue];
  if ([value isKindOfClass:[NSString class]]) {
    NSString *stringValue = [(NSString *)value stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
    if (stringValue.length == 0) return defaultValue;
    return [stringValue integerValue];
  }
  return defaultValue;
}

- (void)saveFcmSermon:(NSDictionary *)data {
  NSLog(@"=== PROCESSING SERMON EVENT ===");
  NSString *sourceId = data[@"source_id"] ?: [NSString stringWithFormat:@"%@", data[@"gcm.message_id"]];
  
  NSString *storageKey = [self asyncStorageKeyForFCMData:data];
  if (storageKey == nil) return;
  
  NSMutableDictionary *sermonData = [SermonBuilder buildFromPayload:data sourceId:sourceId];
  if (data[@"video_url"]) sermonData[@"video_url"] = data[@"video_url"];
  
  if ([sermonData[@"topic"] containsString:@"v2"]) {
    NSArray<NSDictionary *> *refs = sermonData[@"bible_references"];
    NSMutableString *builtContent = [NSMutableString string];
    for (NSDictionary *ref in refs) {
        NSString *book = [ref[@"book"] isKindOfClass:[NSString class]] ? ref[@"book"] : nil;
        NSNumber *chapterNum = [ref[@"chapter"] isKindOfClass:[NSNumber class]] ? ref[@"chapter"] : nil;
        NSNumber *startNum = [ref[@"verseStart"] isKindOfClass:[NSNumber class]] ? ref[@"verseStart"] : nil;
        NSNumber *endNum = [ref[@"verseEnd"] isKindOfClass:[NSNumber class]] ? ref[@"verseEnd"] : nil;

        if (!book || !chapterNum || !startNum || !endNum) continue;

        NSString *text = [[BibleDbHelper shared] getVersesWithBook:book
                                                           chapter:chapterNum.intValue
                                                        verseStart:startNum.intValue
                                                          verseEnd:endNum.intValue];
      if (text.length == 0) continue;
      if (builtContent.length > 0) [builtContent appendString:@"\n\n"];
      [builtContent appendString:text];
    }

    if (builtContent.length > 0) {
      sermonData[@"content"] = builtContent;
    }
  }
  
  NSError *error;
  NSData *jsonData = [NSJSONSerialization dataWithJSONObject:sermonData options:0 error:&error];
  if (jsonData) {
    NSString *jsonString = [[NSString alloc] initWithData:jsonData encoding:NSUTF8StringEncoding];
    BOOL shouldUpdateDisplaySermon = [self isSermonStorageKey:storageKey];
    
    NSLog(@"jsonStrng \n%@", jsonString);
    
    // 1. App Group에 저장
    NSUserDefaults *sharedDefaults = [[NSUserDefaults alloc] initWithSuiteName:@"group.mannachurch.meditationblossom"];
    [sharedDefaults setObject:jsonString forKey:storageKey];
    if (shouldUpdateDisplaySermon) {
      [sharedDefaults setObject:jsonString forKey:@"displaySermon"];
    }
    [sharedDefaults synchronize];
    
    // 2. AsyncStorage 저장 호출 (이제 내부에서 브릿지 준비 상태에 따라 스마트하게 재시도함)
    [self saveToAsyncStorageDirect:jsonString forKey:storageKey];

    // 3. 위젯 갱신
    [WidgetUpdateModule reloadWidgets];

    if (shouldUpdateDisplaySermon) {
      [self sendSermonUpdateEvent];
    } else if ([storageKey isEqualToString:@"fcm_qt"]) {
      [self sendQtUpdateEvent];
    }
  }
}

- (void)sendSermonUpdateEvent {
  UIApplicationState state = [[UIApplication sharedApplication] applicationState];
  if (state == UIApplicationStateActive) {
    if (self.bridge) {
      MyEventModule *eventModule = [self.bridge moduleForClass:[MyEventModule class]];
      if (eventModule) {
        [eventModule trigger:@"New sermon received from FCM"];
        return;
      }
    }
    [[NSNotificationCenter defaultCenter] postNotificationName:@"FCM_SERMON_UPDATE" object:nil];
  }
}

- (void)sendQtUpdateEvent {
  UIApplicationState state = [[UIApplication sharedApplication] applicationState];
  if (state == UIApplicationStateActive) {
    if (self.bridge) {
      MyEventModule *eventModule = [self.bridge moduleForClass:[MyEventModule class]];
      if (eventModule) {
        [eventModule triggerQtUpdate:@"New QT received from FCM"];
        return;
      }
    }
    [[NSNotificationCenter defaultCenter] postNotificationName:@"FCM_QT_UPDATE" object:nil];
  }
}

#pragma mark - UNUserNotificationCenterDelegate

- (void)userNotificationCenter:(UNUserNotificationCenter *)center
       willPresentNotification:(UNNotification *)notification
         withCompletionHandler:(void (^)(UNNotificationPresentationOptions))completionHandler {
  completionHandler(UNNotificationPresentationOptionAlert | UNNotificationPresentationOptionSound);
}

- (void)userNotificationCenter:(UNUserNotificationCenter *)center
didReceiveNotificationResponse:(UNNotificationResponse *)response
         withCompletionHandler:(void(^)(void))completionHandler {
  NSDictionary *userInfo = response.notification.request.content.userInfo;
  NSString *topic = userInfo[@"topic"];
  NSString *from = userInfo[@"from"];
  BOOL isTestTopic = NO;
  if ([self isRecognizedTopic:topic from:from isTestTopic:&isTestTopic]) {
    [self saveFcmSermon:userInfo];
  }
  completionHandler();
}
  
- (void)checkWidgetKitPushDataAndReloadWidgets {
  NSUserDefaults *sharedDefaults = [[NSUserDefaults alloc] initWithSuiteName:@"group.mannachurch.meditationblossom"];
  if (sharedDefaults) {
    NSString *displaySermon = [sharedDefaults stringForKey:@"displaySermon"];
    NSString *fcmSermon = [sharedDefaults stringForKey:@"fcm_sermon"];
    
    if (displaySermon || fcmSermon) {
      dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.5 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
        [WidgetUpdateModule reloadWidgets];
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(1.0 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
          [WidgetUpdateModule reloadWidgets];
        });
      });
    }
  }
}
  
@end
