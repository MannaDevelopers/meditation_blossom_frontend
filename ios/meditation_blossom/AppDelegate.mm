#import "AppDelegate.h"

#import <React/RCTBundleURLProvider.h>
#import <React/RCTBridge.h>
#import <React/RCTRootView.h>
#import <React/RCTLog.h>
#import <React/RCTLinkingManager.h>
#import <FirebaseCore/FirebaseCore.h>
#import <FirebaseMessaging/FirebaseMessaging.h>
#import <FirebaseInAppMessaging/FirebaseInAppMessaging.h>
#import <FirebaseAnalytics/FirebaseAnalytics.h>
#import <UserNotifications/UserNotifications.h>
#import <WidgetKit/WidgetKit.h>
#import <ifaddrs.h>
#import <arpa/inet.h>
#import <string.h>
#import <CommonCrypto/CommonDigest.h>

// Hermes 엔진 확인을 위한 헤더
#if __has_include(<hermes/hermes.h>)
#import <hermes/hermes.h>
#define HERMES_AVAILABLE 1
#else
#define HERMES_AVAILABLE 0
#endif

// AsyncStorage 저장을 위한 헤더
#import <sqlite3.h>

#import "SermonBuilder.h"
#import "meditation_blossom-Swift.h"


@interface AppDelegate () <UNUserNotificationCenterDelegate, FIRMessagingDelegate>
@end

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
  NSString *libDir = NSSearchPathForDirectoriesInDomains(NSLibraryDirectory, NSUserDomainMask, YES).firstObject;
  NSString *dbPath = [[libDir stringByAppendingPathComponent:@"Application Support"]
                                 stringByAppendingPathComponent:@"RKStorage"];
  NSLog(@"📁 DB path: %@", dbPath);
#endif
  
  return result;
}

#pragma mark - Deep Link (URL Scheme)

// 위젯/외부에서 meditationblossom:// 딥링크로 앱을 열 때, URL을 React Native(Linking)로 전달.
// 이 전달이 없으면 App.tsx의 linking(getStateFromPath)이 동작하지 않아 마지막 화면만 복귀됨.
- (BOOL)application:(UIApplication *)application
            openURL:(NSURL *)url
            options:(NSDictionary<UIApplicationOpenURLOptionsKey, id> *)options {
  // WidgetKit 제약: 위젯은 외부 URL(유튜브 등)을 직접 못 열고 항상 호스트 앱을 먼저 띄운다.
  // 따라서 위젯이 https/http URL로 앱을 열면, 앱이 그 URL을 받아 직접 외부 브라우저로 넘긴다.
  if ([url.scheme isEqualToString:@"http"] || [url.scheme isEqualToString:@"https"]) {
    [application openURL:url options:@{} completionHandler:nil];
    return YES;
  }

  // meditationblossom:// 딥링크는 React Native(Linking)로 전달.
  return [RCTLinkingManager application:application openURL:url options:options];
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

// AsyncStorage 저장 (타이밍 이슈 방지 재시도 로직 포함)
- (void)saveToAsyncStorageDirect:(NSString *)jsonString forKey:(NSString *)key {
  if (!jsonString || !key) {
    NSLog(@"❌ AsyncStorage save skipped: key or value is nil");
    return;
  }

  NSString *libDir = NSSearchPathForDirectoriesInDomains(NSLibraryDirectory, NSUserDomainMask, YES).firstObject;
    NSString *dbPath = [[libDir stringByAppendingPathComponent:@"Application Support"]
                                 stringByAppendingPathComponent:@"RKStorage"];
    
    NSLog(@"📁 DB path: %@", dbPath);
    
    // DB 파일 없으면 생성 (테이블도 같이)
    sqlite3 *db;
    if (sqlite3_open([dbPath UTF8String], &db) != SQLITE_OK) {
      NSLog(@"❌ Failed to open DB: %s", sqlite3_errmsg(db));
      return;
    }
    
    // 테이블 없으면 생성
    const char *createSQL = "CREATE TABLE IF NOT EXISTS catalystLocalStorage (key TEXT PRIMARY KEY, value TEXT NOT NULL)";
    sqlite3_exec(db, createSQL, nil, nil, nil);
    
    // upsert
    const char *upsertSQL = "INSERT OR REPLACE INTO catalystLocalStorage (key, value) VALUES (?, ?)";
    sqlite3_stmt *stmt;
    if (sqlite3_prepare_v2(db, upsertSQL, -1, &stmt, nil) == SQLITE_OK) {
      sqlite3_bind_text(stmt, 1, [key UTF8String], -1, SQLITE_TRANSIENT);
      sqlite3_bind_text(stmt, 2, [jsonString UTF8String], -1, SQLITE_TRANSIENT);
      
      if (sqlite3_step(stmt) == SQLITE_DONE) {
        NSLog(@"✅ DB write success for key: %@", key);
      } else {
        NSLog(@"❌ DB write failed: %s", sqlite3_errmsg(db));
      }
      sqlite3_finalize(stmt);
    }
    sqlite3_close(db);
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

  // meditation_questions: FCM은 평문 문자열로 전달 → QT.swift가 [String] 배열로 디코딩할 수 있도록
  // JSON 배열 문자열로 변환하여 저장한다. useQtWidgetSync.ts(앱 실행 중)와 동일한 포맷을 유지.
  id rawQuestions = sermonData[@"meditation_questions"];
  if ([rawQuestions isKindOfClass:[NSString class]] && [(NSString *)rawQuestions length] > 0) {
    NSString *qStr = (NSString *)rawQuestions;
    NSData *testData = [qStr dataUsingEncoding:NSUTF8StringEncoding];
    id parsedTest = [NSJSONSerialization JSONObjectWithData:testData options:0 error:nil];
    if (![parsedTest isKindOfClass:[NSArray class]]) {
      // 평문 → 줄바꿈으로 분리해 JSON 배열로 변환
      NSArray *lines = [qStr componentsSeparatedByString:@"\n"];
      NSMutableArray *filtered = [NSMutableArray array];
      for (NSString *line in lines) {
        NSString *trimmed = [line stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
        if (trimmed.length > 0) [filtered addObject:trimmed];
      }
      NSData *jsonData2 = [NSJSONSerialization dataWithJSONObject:filtered options:0 error:nil];
      if (jsonData2) {
        sermonData[@"meditation_questions"] = [[NSString alloc] initWithData:jsonData2 encoding:NSUTF8StringEncoding];
      }
    }
  }

  // sermon_events_v2 과 qt_events 모두 bible_references 배열로 말씀 데이터가 전달된다.
  // content 필드는 FCM 4KB 제약으로 포함되지 않으며, 빈 배열([])은 말씀 없는 날을 의미한다.
  // 서버는 snake_case 키(verse_start, verse_end) 사용, 또한 verses 배열로 본문을 미리 제공할 수 있다.
  NSString *topic = sermonData[@"topic"] ?: @"";
  BOOL shouldResolveBibleRefs = [topic containsString:@"v2"] || [topic containsString:@"qt_events"];
  if (shouldResolveBibleRefs) {
    NSArray<NSDictionary *> *refs = sermonData[@"bible_references"];
    // refs가 여러 개인 경우 Android BibleReferenceResolver와 동일하게
    // "본문 : 참조1, 참조2 구절1 구절2" 형태로 합친다.
    // 각 ref를 별도 "본문 : ..." 문자열로 만들면 두 번째부터 파싱이 깨진다.
    NSMutableArray<NSString *> *allRefStrings = [NSMutableArray array];
    NSMutableString *allVerseBody = [NSMutableString string];

    for (NSDictionary *ref in refs) {
        NSString *book = [ref[@"book"] isKindOfClass:[NSString class]] ? ref[@"book"] : nil;
        NSNumber *chapterNum = [ref[@"chapter"] isKindOfClass:[NSNumber class]] ? ref[@"chapter"] : nil;
        NSNumber *startNum = [ref[@"verse_start"] isKindOfClass:[NSNumber class]] ? ref[@"verse_start"] : nil;
        NSNumber *endNum   = [ref[@"verse_end"]   isKindOfClass:[NSNumber class]] ? ref[@"verse_end"]   : nil;

        if (!book || !chapterNum || !startNum || !endNum) continue;

        int from = startNum.intValue;
        int to   = endNum.intValue;
        NSString *rangeStr = (from == to)
            ? [NSString stringWithFormat:@"%d:%d", chapterNum.intValue, from]
            : [NSString stringWithFormat:@"%d:%d-%d", chapterNum.intValue, from, to];

        NSMutableString *verseBody = [NSMutableString string];

        // 서버가 verses 배열로 본문을 미리 제공하면 DB 조회 불필요
        NSArray *verses = [ref[@"verses"] isKindOfClass:[NSArray class]] ? ref[@"verses"] : nil;
        if (verses.count > 0) {
            for (NSDictionary *verse in verses) {
                NSString *content = [verse[@"content"] isKindOfClass:[NSString class]] ? verse[@"content"] : nil;
                if (!content || content.length == 0) continue;
                NSNumber *verseNum = [verse[@"verse_number"] isKindOfClass:[NSNumber class]] ? verse[@"verse_number"] : nil;
                if (verseBody.length > 0) [verseBody appendString:@" "];
                if (verseNum) {
                    [verseBody appendFormat:@"%@ %@", verseNum, content];
                } else {
                    [verseBody appendString:content];
                }
            }
        }

        // embedded verses 없으면 bible.db 직접 조회
        if (verseBody.length == 0) {
            NSString *text = [[BibleDbHelper shared] getVersesWithBook:book
                                                               chapter:chapterNum.intValue
                                                            verseStart:from
                                                              verseEnd:to];
            if (text.length > 0) {
                [verseBody appendString:text];
            }
        }

        if (verseBody.length == 0) continue;

        [allRefStrings addObject:[NSString stringWithFormat:@"%@ %@", book, rangeStr]];
        if (allVerseBody.length > 0) [allVerseBody appendString:@" "];
        [allVerseBody appendString:verseBody];
    }

    // Android 포맷: "본문 : 참조1, 참조2 31 구절1 32 구절2 25 구절3..."
    // extractContent(sermonParser.ts)의 bookNameRegex가 쉼표 구분 참조를 지원한다.
    if (allRefStrings.count > 0) {
        NSString *reference = [allRefStrings componentsJoinedByString:@", "];
        sermonData[@"content"] = [NSString stringWithFormat:@"본문 : %@ %@", reference, allVerseBody];
    } else {
        // 말씀 없는 날(빈 배열)
        sermonData[@"content"] = @"";
    }
  }
  
  NSError *error;
  NSData *jsonData = [NSJSONSerialization dataWithJSONObject:sermonData options:0 error:&error];
  if (jsonData) {
    NSString *jsonString = [[NSString alloc] initWithData:jsonData encoding:NSUTF8StringEncoding];
    BOOL shouldUpdateDisplaySermon = [self isSermonStorageKey:storageKey];
    
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
  // MyEventModule이 FCM_SERMON_UPDATE_INTERNAL를 구독하고 있다.
  // self.bridge 의존 없이 모듈 자신의 bridge로 JS에 emit → New Architecture 호환.
  dispatch_async(dispatch_get_main_queue(), ^{
    [[NSNotificationCenter defaultCenter] postNotificationName:@"FCM_SERMON_UPDATE_INTERNAL" object:nil];
  });
}

- (void)sendQtUpdateEvent {
  dispatch_async(dispatch_get_main_queue(), ^{
    [[NSNotificationCenter defaultCenter] postNotificationName:@"FCM_QT_UPDATE_INTERNAL" object:nil];
  });
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
