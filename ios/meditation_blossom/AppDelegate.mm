#import "AppDelegate.h"

#import <React/RCTBridge.h>
#import <React/RCTLog.h>
#import <FirebaseCore/FirebaseCore.h>
#import <FirebaseMessaging/FirebaseMessaging.h>
#import <FirebaseInAppMessaging/FirebaseInAppMessaging.h>
#import <FirebaseAnalytics/FirebaseAnalytics.h>
#import <UserNotifications/UserNotifications.h>
#import <WidgetKit/WidgetKit.h>
#import <React/RCTUtils.h>

#import "SermonBuilder.h"
// meditation_blossom-Swift.h에 SceneDelegate(부모: RCTDefaultReactNativeFactoryDelegate)가 노출되므로 먼저 선언을 가져온다([#342])
#import <React_RCTAppDelegate/RCTDefaultReactNativeFactoryDelegate.h>
#import "meditation_blossom-Swift.h"

// RCTAsyncLocalStorage_V1 디렉토리 경로 (RN 0.78 파일 기반 AsyncStorage)
static NSString *MBAsyncStorageDirectory(void)
{
  NSString *appSupportDir = NSSearchPathForDirectoriesInDomains(
      NSApplicationSupportDirectory, NSUserDomainMask, YES).firstObject;
  NSString *bundleId = [[NSBundle mainBundle] bundleIdentifier];
  return [[appSupportDir stringByAppendingPathComponent:bundleId]
      stringByAppendingPathComponent:@"RCTAsyncLocalStorage_V1"];
}

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
  // React Native 시작(moduleName, dependencyProvider, bundleURL)은 SceneDelegate.swift가 맡는다([#342]).

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

  // [#306] iOS 파트: NotificationService(Extension)는 RN AsyncStorage를 못 읽으므로 예배시간
  // 설정을 App Group에도 미러링해둬야 한다. SettingsScreen에서 바뀔 때는
  // WidgetUpdateModule.setWorshipSetting이 갱신하지만, 이 앱 버전으로 업데이트한 뒤 설정
  // 화면을 한 번도 안 연 기존 사용자를 위해 여기서 기존 AsyncStorage 값을 백필한다.
  NSString *worshipSetting = [self readFromAsyncStorageDirect:@"user_worship_setting"];
  if (worshipSetting.length > 0) {
    [WorshipSermonSync mirrorSetting:worshipSetting];
  }

  // React Native 로그 레벨 설정 (디버깅용)
  RCTSetLogThreshold(RCTLogLevelInfo);

#if DEBUG
  NSLog(@"📁 AsyncStorage path: %@", MBAsyncStorageDirectory());
#endif

  return YES;
}

#pragma mark - UIScene

// [#342] 화면(window)과 URL(딥링크·위젯 탭) 처리는 Info.plist의 UIApplicationSceneManifest에
// 등록한 SceneDelegate가 맡는다. (기존 application:openURL:options:는 Scene 기반 앱에서
// 호출되지 않으므로 SceneDelegate의 scene:openURLContexts:로 옮겼다.)
- (UISceneConfiguration *)application:(UIApplication *)application
    configurationForConnectingSceneSession:(UISceneSession *)connectingSceneSession
                                   options:(UISceneConnectionOptions *)options {
  return [[UISceneConfiguration alloc] initWithName:@"Default Configuration"
                                        sessionRole:connectingSceneSession.role];
}

// AppDelegate.h의 window 설명 참고. 다중 Scene을 지원하지 않으므로(UIApplicationSupportsMultipleScenes
// = NO) 연결된 UIWindowScene의 delegate window를 그대로 돌려준다. Scene 연결 전이면 nil.
- (UIWindow *)window {
  for (UIScene *scene in [UIApplication sharedApplication].connectedScenes) {
    if (![scene isKindOfClass:[UIWindowScene class]]) continue;
    id<UISceneDelegate> sceneDelegate = scene.delegate;
    if ([sceneDelegate conformsToProtocol:@protocol(UIWindowSceneDelegate)] &&
        [sceneDelegate respondsToSelector:@selector(window)]) {
      UIWindow *window = ((id<UIWindowSceneDelegate>)sceneDelegate).window;
      if (window != nil) return window;
    }
  }
  return nil;
}

#pragma mark - React Native Notification Handlers

// 6. 모든 네이티브 모듈이 준비되었을 때 실행되는 콜백
- (void)handleJavaScriptDidLoad:(NSNotification *)notification {
  NSLog(@"✅ [Notification] JavaScript bundle loaded successfully!");

  // [#342] RN 0.88(bridgeless)에서는 notification.object가 RCTBridge가 아니라 RCTInstance라서
  // `.valid`(isValid)를 부르면 unrecognized selector로 앱이 종료된다. JS 로드 완료 알림 자체가
  // 준비 신호이므로 브리지 유효성 검사 없이 위젯 갱신만 한다.
  [self checkWidgetKitPushDataAndReloadWidgets];
}

// 객체 소멸 시 알림 리스너 해제
- (void)dealloc {
  [[NSNotificationCenter defaultCenter] removeObserver:self];
}

#pragma mark - AsyncStorage Storage Helper

// Bridgeless 환경에서 JS bridge에 의존하지 않고 AsyncStorage 파일에 직접 저장
// RN 0.78 파일 기반 AsyncStorage: manifest.json + 값 파일 (1KB 초과 시)
- (void)saveToAsyncStorageDirect:(NSString *)jsonString forKey:(NSString *)key {
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
      NSDictionary *existing = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
      if (existing) [manifest addEntriesFromDictionary:existing];
    }
  }

  static const NSUInteger kInlineValueThreshold = 1024;

  if (jsonString.length <= kInlineValueThreshold) {
    manifest[key] = jsonString;
  } else {
    // 큰 값은 별도 파일에 저장하고 manifest에 NSNull 마커
    NSString *hashedKey = RCTMD5Hash(key);
    NSString *valuePath = [storageDir stringByAppendingPathComponent:hashedKey];
    NSError *writeError = nil;
    [jsonString writeToFile:valuePath atomically:YES encoding:NSUTF8StringEncoding error:&writeError];
    if (writeError) {
      NSLog(@"❌ Failed to write value file: %@", writeError.localizedDescription);
      return;
    }
    manifest[key] = [NSNull null];
  }

  NSError *jsonError = nil;
  NSData *manifestData = [NSJSONSerialization dataWithJSONObject:manifest options:0 error:&jsonError];
  if (jsonError || !manifestData) {
    NSLog(@"❌ Failed to serialize manifest: %@", jsonError.localizedDescription);
    return;
  }

  NSError *writeError = nil;
  [manifestData writeToFile:manifestPath options:NSDataWritingAtomic error:&writeError];
  if (writeError) {
    NSLog(@"❌ Failed to write manifest: %@", writeError.localizedDescription);
  } else {
    NSLog(@"✅ AsyncStorage write success for key: %@", key);
  }
}

// manifest.json + (1KB 초과 시) 값 파일로 나뉘는 RN 0.78 AsyncStorage 포맷을 읽는다.
// saveToAsyncStorageDirect의 read 대응 버전([#306] 예배시간 설정 백필용).
- (nullable NSString *)readFromAsyncStorageDirect:(NSString *)key {
  NSString *storageDir = MBAsyncStorageDirectory();
  NSString *manifestPath = [storageDir stringByAppendingPathComponent:@"manifest.json"];
  NSFileManager *fm = [NSFileManager defaultManager];
  if (![fm fileExistsAtPath:manifestPath]) return nil;

  NSData *data = [NSData dataWithContentsOfFile:manifestPath];
  if (!data) return nil;
  NSDictionary *manifest = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
  if (!manifest) return nil;

  id value = manifest[key];
  if ([value isKindOfClass:[NSString class]]) {
    return (NSString *)value;
  }
  if (value == [NSNull null]) {
    NSString *hashedKey = RCTMD5Hash(key);
    NSString *valuePath = [storageDir stringByAppendingPathComponent:hashedKey];
    return [NSString stringWithContentsOfFile:valuePath encoding:NSUTF8StringEncoding error:nil];
  }
  return nil;
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
  // sermons-v2: 예배 시간별(worship_type) 주간 데이터 전용 토픽. sermon_events_v2와 별도로 동시 운영된다.
  [[FIRMessaging messaging] subscribeToTopic:@"sermons_v2_events" completion:nil];

#ifdef DEBUG
  [[FIRMessaging messaging] subscribeToTopic:@"sermon_events_test" completion:nil];
  [[FIRMessaging messaging] subscribeToTopic:@"qt_events_test" completion:nil];
  [[FIRMessaging messaging] subscribeToTopic:@"sermons_v2_events_test" completion:nil];
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

  NSArray<NSString *> *productionTopics = @[@"sermon_events", @"qt_events", @"sermon_events_v2", @"sermons_v2_events"];
  for (NSString *candidate in productionTopics) {
    if ([normalizedTopic isEqualToString:candidate] || [normalizedFrom containsString:candidate]) {
      return YES;
    }
  }

#ifdef DEBUG
  NSArray<NSString *> *testTopics = @[@"sermon_events_test", @"qt_events_test", @"sermons_v2_events_test"];
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

  // sermons-v2(예배 시간별 말씀, [#306]): week/worship_type이 있으면 이 이벤트다.
  // payload엔 id가 없다 — Firestore 문서 ID 규칙과 동일하게 구성한다(JS/Android와 동일).
  NSString *week = [sermonData[@"week"] isKindOfClass:[NSString class]] ? sermonData[@"week"] : @"";
  NSString *worshipType = [sermonData[@"worship_type"] isKindOfClass:[NSString class]] ? sermonData[@"worship_type"] : @"";
  BOOL isWeeklyEvent = week.length > 0 && worshipType.length > 0;
  if (isWeeklyEvent) {
    sermonData[@"id"] = [WorshipSermonSync weeklySermonIdWithWeek:week worshipType:worshipType];
  }

  // JS Sermon/SermonRaw 타입은 bible_references를 원본 FCM payload와 동일하게 JSON "문자열"로
  // 취급한다(useScripturePassages가 JSON.parse로 다시 해석). 그런데 SermonBuilder가 위에서
  // bible_references를 이미 파싱된 배열로 바꿔뒀고 그걸 그대로 최종 JSON에 실으면, 이 dictionary가
  // AsyncStorage/App Group에 저장됐다가 JS가 다시 읽을 때 문자열이 아닌 배열을 받게 된다.
  // JSON.parse(배열)은 배열을 "[object Object]" 등으로 강제 문자열화한 뒤 파싱을 시도해
  // "Unexpected character: o" 파싱 에러로 이어진다(실기기 QA 중 발견). 최종 저장 직전에
  // 다시 JSON 문자열로 되돌려 원본 payload와 같은 모양을 유지한다.
  id bibleReferencesValue = sermonData[@"bible_references"];
  if ([bibleReferencesValue isKindOfClass:[NSArray class]]) {
    NSData *bibleRefsData = [NSJSONSerialization dataWithJSONObject:bibleReferencesValue options:0 error:nil];
    sermonData[@"bible_references"] = bibleRefsData
        ? [[NSString alloc] initWithData:bibleRefsData encoding:NSUTF8StringEncoding]
        : @"[]";
  }

  NSError *error;
  NSData *jsonData = [NSJSONSerialization dataWithJSONObject:sermonData options:0 error:&error];
  if (jsonData) {
    NSString *jsonString = [[NSString alloc] initWithData:jsonData encoding:NSUTF8StringEncoding];
    NSUserDefaults *sharedDefaults = [[NSUserDefaults alloc] initWithSuiteName:@"group.mannachurch.meditationblossom"];

    if (isWeeklyEvent) {
      // 앱이 실행되면 JS가 이 대기열을 weekly_sermons 캐시로 병합해간다([useAppGroupSync]).
      [WorshipSermonSync appendPendingWeeklySermon:jsonString week:week worshipType:worshipType];

      NSString *setting = [WorshipSermonSync currentSetting];
      // [ISSUE-315] week/now를 명시적으로 넘겨야 한다 — Swift 쪽 기본값(week=nil, now=Date())은
      // ObjC에서 보이는 selector에 반영되지 않아 이 인자들 없이는 컴파일이 안 된다. week 없이
      // 부르면 시각 게이팅 없이 즉시 반영되던 예전 동작으로 돌아가버리므로 반드시 넘겨야 한다.
      if ([WorshipSermonSync shouldApplyWeeklyEventWithWorshipType:worshipType stored:setting week:week now:[NSDate date]]) {
        [sharedDefaults setObject:jsonString forKey:@"fcm_sermon"];
        [sharedDefaults setObject:jsonString forKey:@"displaySermon"];
        [sharedDefaults synchronize];
        [self saveToAsyncStorageDirect:jsonString forKey:@"fcm_sermon"];
        [WidgetUpdateModuleImpl reloadWidgets];
      } else {
        NSLog(@"saveFcmSermon: weekly sermon queued only (worship_type=%@, setting=%@)", worshipType, setting ?: @"unknown");
      }

      // week/worship_type/video_url 등 원본 payload를 함께 보내면 JS(포그라운드일 때)가
      // weekly_sermons 캐시를 전체 재조회 없이 해당 문서 하나만 patch할 수 있다([#280]).
      [self sendSermonUpdateEventWithData:data];
      return;
    }

    BOOL shouldUpdateDisplaySermon = [self isSermonStorageKey:storageKey];

    // 레거시 sermon_events(_v2): '전체'가 아니면(설정을 아는 상태에서 특정 예배시간을 골라둔
    // 경우) 위젯/'지금 화면' 슬롯은 건드리지 않고 legacy 전용 캐시에만 저장한다([#307] iOS 파트).
    // 설정을 모르면(App Group에 아직 없으면) 기존 동작을 유지한다.
    if (shouldUpdateDisplaySermon) {
      NSString *setting = [WorshipSermonSync currentSetting];
      if (![WorshipSermonSync isAllOrUnknownSetting:setting]) {
        [sharedDefaults setObject:jsonString forKey:@"legacy_sermon_cache"];
        [sharedDefaults synchronize];
        [self saveToAsyncStorageDirect:jsonString forKey:@"legacy_sermon_cache"];
        NSLog(@"saveFcmSermon: setting=%@ != ALL, saved legacy payload to legacy cache only", setting ?: @"unknown");
        [self sendSermonUpdateEventWithData:data];
        return;
      }
    }

    // 1. App Group에 저장
    [sharedDefaults setObject:jsonString forKey:storageKey];
    if (shouldUpdateDisplaySermon) {
      [sharedDefaults setObject:jsonString forKey:@"displaySermon"];
      // '전체'로 반영했으니 legacy 캐시도 같이 최신화해둔다 — 특정 예배시간으로 바꿨다가 다시
      // '전체'로 돌아왔을 때 비교할 기준선이 된다(SettingsScreen.fetchReconciledLegacySermon).
      [sharedDefaults setObject:jsonString forKey:@"legacy_sermon_cache"];
    }
    [sharedDefaults synchronize];

    // 2. AsyncStorage 저장 호출 (이제 내부에서 브릿지 준비 상태에 따라 스마트하게 재시도함)
    [self saveToAsyncStorageDirect:jsonString forKey:storageKey];

    // 3. 위젯 갱신
    [WidgetUpdateModuleImpl reloadWidgets];

    if (shouldUpdateDisplaySermon) {
      // 레거시 sermon_events(_v2)도 원본 payload(data)를 그대로 실어 보낸다 — JS가
      // Firestore를 다시 조회하지 않고 sermonService.sermonFromLegacyEvent로 바로
      // 화면/위젯에 반영할 수 있게 한다(sermons-v2와 동일한 패턴).
      [self sendSermonUpdateEventWithData:data];
    } else if ([storageKey isEqualToString:@"fcm_qt"]) {
      [self sendQtUpdateEvent];
    }
  }
}

- (void)sendSermonUpdateEventWithData:(NSDictionary *)data {
  // MyEventModule이 FCM_SERMON_UPDATE_INTERNAL를 구독하고 있다.
  // self.bridge 의존 없이 모듈 자신의 bridge로 JS에 emit → New Architecture 호환.
  // userInfo가 nil이면(정말 payload가 없는 wake-up만) JS가 안전하게 폴백 처리한다.
  dispatch_async(dispatch_get_main_queue(), ^{
    [[NSNotificationCenter defaultCenter] postNotificationName:@"FCM_SERMON_UPDATE_INTERNAL" object:nil userInfo:data];
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
        [WidgetUpdateModuleImpl reloadWidgets];
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(1.0 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
          [WidgetUpdateModuleImpl reloadWidgets];
        });
      });
    }
  }
}
  
@end
