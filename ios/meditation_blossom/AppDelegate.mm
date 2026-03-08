#import "AppDelegate.h"

#import <React/RCTBundleURLProvider.h>
#import <React/RCTBridge.h>
#import <React/RCTRootView.h>
#import <React/RCTLog.h>
#import <FirebaseCore/FirebaseCore.h>
#import <FirebaseMessaging/FirebaseMessaging.h>
#import <FirebaseInAppMessaging/FirebaseInAppMessaging.h>
#import <FirebaseAnalytics/FirebaseAnalytics.h>
#import <UserNotifications/UserNotifications.h>
#import <WidgetKit/WidgetKit.h>
#import <ifaddrs.h>
#import <arpa/inet.h>

// Hermes 엔진 확인을 위한 헤더
#if __has_include(<hermes/hermes.h>)
#import <hermes/hermes.h>
#define HERMES_AVAILABLE 1
#else
#define HERMES_AVAILABLE 0
#endif
// 디버깅용 imports (테스트 완료 후 주석 처리)
// #import <FirebaseInstallations/FirebaseInstallations.h>

// AsyncStorage 저장을 위한 헤더
#if __has_include(<RNCAsyncStorage/RNCAsyncStorage.h>)
#import <RNCAsyncStorage/RNCAsyncStorage.h>
#elif __has_include("RNCAsyncStorage.h")
#import "RNCAsyncStorage.h"
#endif

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
  NSLog(@"🎯 ========================================");
  NSLog(@"🎯 AppDelegate: didFinishLaunchingWithOptions");
  NSLog(@"🎯 App launch options: %@", launchOptions);
  
  // App Group 데이터 확인은 React Native Bridge 초기화 완료 후로 지연
  // Bridge 초기화 전에 실행하면 빈 화면이 나타날 수 있음
  // WidgetKit Push 데이터 확인은 Bridge가 준비된 후 실행
  
  // Extension 설치 확인 (앱 번들에서 확인)
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
        NSLog(@"   - Extension: %@", pluginName);
        if ([pluginName containsString:@"PushNotificationService"]) {
          NSLog(@"     ✅ PushNotificationService extension is installed!");
        }
        if ([pluginName containsString:@"MeditationBlossomWidgetExtension"]) {
          NSLog(@"     ✅ MeditationBlossomWidgetExtension is installed!");
        }
      }
    } else {
      NSLog(@"   ⚠️ Failed to list PlugIns: %@", error);
    }
  } else {
    NSLog(@"❌ PlugIns directory does not exist - no extensions are installed!");
    NSLog(@"❌ This means app extensions were not embedded during build");
  }
  
  // Network connection logging 활성화 (디버깅용)
  [[NSUserDefaults standardUserDefaults] setBool:YES forKey:@"NSURLSessionVerboseLogging"];
  
  // Metro 서버 연결 테스트 (디버깅용)
  #if DEBUG
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(2.0 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
    NSURL *testURL = [NSURL URLWithString:@"http://172.30.1.25:8081/status"];
    if (testURL) {
      NSURLSession *session = [NSURLSession sharedSession];
      NSURLSessionDataTask *task = [session dataTaskWithURL:testURL completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
        if (error) {
          NSLog(@"❌ Metro server connection test failed: %@", error);
        } else {
          NSLog(@"✅ Metro server connection test successful: %@", response);
        }
      }];
      [task resume];
      NSLog(@"🔍 Testing Metro server connection to: %@", testURL);
    }
  });
  #endif
  
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
  
  NSLog(@"🔥 FCM delegate set");
  
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

  BOOL result = [super application:application didFinishLaunchingWithOptions:launchOptions];
  
  NSLog(@"🎯 React Native super application:didFinishLaunchingWithOptions returned: %@", result ? @"YES" : @"NO");
  
  // Bridge 초기화 확인 (바로 확인)
  NSLog(@"🎯 Checking React Native Bridge immediately...");
  NSLog(@"   - self.bridge exists: %@", self.bridge ? @"YES" : @"NO");
  
  if (self.bridge) {
    NSLog(@"✅ React Native Bridge initialized successfully");
    NSLog(@"   - Bridge loading: %@", @(self.bridge.loading));
    NSLog(@"   - Bridge valid: %@", @(self.bridge.valid));
    NSLog(@"   - Bridge moduleClasses count: %lu", (unsigned long)self.bridge.moduleClasses.count);
    
    // JavaScript 실행 대기 (Bridge가 준비될 때까지)
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.5 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
      NSLog(@"🎯 Checking React Native Bridge state after 0.5 seconds...");
      NSLog(@"   - self.bridge exists: %@", self.bridge ? @"YES" : @"NO");
      if (self.bridge) {
        NSLog(@"   - Bridge loading: %@", @(self.bridge.loading));
        NSLog(@"   - Bridge valid: %@", @(self.bridge.valid));
        
        if (self.bridge.loading) {
          NSLog(@"⚠️ Bridge is still loading JavaScript bundle...");
        } else if (self.bridge.valid) {
          NSLog(@"✅ Bridge is valid - JavaScript bundle loaded successfully");
          
          // Bridge가 준비된 후 App Group 데이터 확인 및 위젯 리로드
          // 이 시점에서 실행하면 빈 화면 문제를 방지할 수 있음
          [self checkWidgetKitPushDataAndReloadWidgets];
        } else {
          NSLog(@"❌ Bridge is NOT valid - JavaScript bundle may have failed to load");
        }
      } else {
        NSLog(@"❌ Bridge is nil - React Native initialization may have failed");
      }
      
      // Root view controller 확인
      UIWindow *keyWindow = [UIApplication sharedApplication].keyWindow;
      NSLog(@"   - Key window exists: %@", keyWindow ? @"YES" : @"NO");
      
      if (keyWindow) {
        UIViewController *rootViewController = keyWindow.rootViewController;
        if (rootViewController) {
          NSLog(@"✅ Root view controller exists: %@", NSStringFromClass([rootViewController class]));
          NSLog(@"   - Root view exists: %@", rootViewController.view ? @"YES" : @"NO");
        } else {
          NSLog(@"❌ Root view controller is nil - app may show blank screen");
        }
      } else {
        NSLog(@"❌ Key window is nil - app window may not be ready");
      }
    });
    
    // 2초 후 추가 확인
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(2.0 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
      NSLog(@"🎯 Checking React Native state after 2 seconds...");
      NSLog(@"   - self.bridge exists: %@", self.bridge ? @"YES" : @"NO");
      if (self.bridge) {
        NSLog(@"   - Bridge loading: %@", @(self.bridge.loading));
        NSLog(@"   - Bridge valid: %@", @(self.bridge.valid));
        
        // JavaScript 실행 확인
        [self checkJavaScriptExecution];
      } else {
        NSLog(@"❌ Bridge is still nil after 2 seconds - React Native initialization failed");
      }
    });
    
    // Hermes 엔진 확인
    #if HERMES_AVAILABLE
    NSLog(@"✅ Hermes engine is available");
    #else
    NSLog(@"❌ Hermes engine is NOT available - JavaScript execution may fail!");
    #endif
    
    // React Native 로그 레벨 설정 (디버깅용)
    RCTSetLogThreshold(RCTLogLevelInfo);
    RCTSetLogFunction(^(RCTLogLevel level, RCTLogSource source, NSString *fileName, NSNumber *lineNumber, NSString *message) {
      if (level >= RCTLogLevelError) {
        NSLog(@"❌ React Native Error: %@", message);
      } else if (level >= RCTLogLevelWarning) {
        NSLog(@"⚠️ React Native Warning: %@", message);
      } else {
        NSLog(@"ℹ️ React Native Info: %@", message);
      }
    });
    
    // Bridge의 번들 로딩 상태 확인을 위한 KVO 추가
    #if DEBUG
    [self.bridge addObserver:self forKeyPath:@"loading" options:NSKeyValueObservingOptionNew context:nil];
    [self.bridge addObserver:self forKeyPath:@"valid" options:NSKeyValueObservingOptionNew context:nil];
    
    // 루트 뷰 확인
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(1.0 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
      UIViewController *rootViewController = [UIApplication sharedApplication].keyWindow.rootViewController;
      if (rootViewController) {
        NSLog(@"🔍 Root view controller found: %@", NSStringFromClass([rootViewController class]));
        if (rootViewController.view) {
          NSLog(@"   - Root view exists: YES");
          NSLog(@"   - Root view frame: %@", NSStringFromCGRect(rootViewController.view.frame));
          
          // React Native 루트 뷰 찾기
          UIView *reactRootView = [self findReactRootView:rootViewController.view];
          if (reactRootView) {
            NSLog(@"   - React Native root view found: YES");
            NSLog(@"   - React root view frame: %@", NSStringFromCGRect(reactRootView.frame));
            NSLog(@"   - React root view subviews count: %lu", (unsigned long)reactRootView.subviews.count);
            
            // 서브뷰 상세 정보
            for (NSUInteger i = 0; i < reactRootView.subviews.count; i++) {
              UIView *subview = reactRootView.subviews[i];
              NSLog(@"   - Subview[%lu]: %@, frame: %@", (unsigned long)i, NSStringFromClass([subview class]), NSStringFromCGRect(subview.frame));
            }
          } else {
            NSLog(@"   - React Native root view found: NO");
          }
        }
      } else {
        NSLog(@"❌ Root view controller not found");
      }
    });
    
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(3.0 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
      if (self.bridge) {
        NSLog(@"🔍 Bridge state after 3 seconds:");
        NSLog(@"   - Bridge exists: YES");
        NSLog(@"   - Bridge loading: %@", @(self.bridge.loading));
        NSLog(@"   - Bridge valid: %@", @(self.bridge.valid));
        
        // Bridge가 여전히 valid 상태라면 위젯 데이터 확인 (fallback)
        if (self.bridge.valid) {
          [self checkWidgetKitPushDataAndReloadWidgets];
        }
        NSLog(@"   - Bridge moduleClasses count: %lu", (unsigned long)self.bridge.moduleClasses.count);
        
        // Bridge가 번들을 로드하려고 시도하는지 확인
        NSURL *bundleURL = [self bundleURL];
        NSLog(@"   - Bundle URL: %@", bundleURL);
        
        // 직접 번들 로드 시도 (디버깅용)
        if (bundleURL && [bundleURL.scheme isEqualToString:@"http"]) {
          NSLog(@"🔍 Attempting to manually load bundle from: %@", bundleURL);
          NSURLSession *session = [NSURLSession sharedSession];
          NSURLSessionDataTask *task = [session dataTaskWithURL:bundleURL completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
            if (error) {
              NSLog(@"❌ Manual bundle load failed: %@", error);
            } else {
              NSLog(@"✅ Manual bundle load successful: %lu bytes", (unsigned long)data.length);
              if (data.length > 0) {
                NSLog(@"   - First 100 bytes: %@", [[NSString alloc] initWithData:[data subdataWithRange:NSMakeRange(0, MIN(100, data.length))] encoding:NSUTF8StringEncoding]);
                
                // Bridge가 번들을 로드하지 못하는 경우, 직접 로드 시도
                if (!self.bridge.valid && !self.bridge.loading) {
                  NSLog(@"⚠️ Bridge is not loading bundle. Attempting to reload bridge...");
                  dispatch_async(dispatch_get_main_queue(), ^{
                    [self.bridge reload];
                  });
                }
              }
            }
          }];
          [task resume];
        }
        
        // JavaScript 실행 상태 확인 (5초 후)
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(2.0 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
          [self checkJavaScriptExecution];
        });
      }
    });
    #endif
  } else {
    NSLog(@"❌ React Native Bridge initialization failed - self.bridge is nil");
    NSLog(@"   - This means React Native did not initialize properly");
    NSLog(@"   - App will show blank screen");
    
    // 1초 후 다시 확인
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(1.0 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
      NSLog(@"🎯 Re-checking Bridge after 1 second...");
      NSLog(@"   - self.bridge exists: %@", self.bridge ? @"YES" : @"NO");
      if (self.bridge) {
        NSLog(@"✅ Bridge appeared! It was just delayed.");
        NSLog(@"   - Bridge loading: %@", @(self.bridge.loading));
        NSLog(@"   - Bridge valid: %@", @(self.bridge.valid));
      } else {
        NSLog(@"❌ Bridge is still nil - React Native initialization definitely failed");
      }
    });
  }
  
  return result;
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  NSURL *url = [self bundleURL];
  NSLog(@"🌉 Bridge requesting bundle URL: %@", url);
  NSLog(@"   - Bridge loading state: %@", @(bridge.loading));
  NSLog(@"   - Bridge valid state: %@", @(bridge.valid));
  return url;
}

// Bridge 상태 변경 감지를 위한 KVO
- (void)observeValueForKeyPath:(NSString *)keyPath ofObject:(id)object change:(NSDictionary<NSKeyValueChangeKey,id> *)change context:(void *)context
{
  if ([keyPath isEqualToString:@"loading"]) {
    BOOL loading = [change[NSKeyValueChangeNewKey] boolValue];
    NSLog(@"🔍 Bridge loading state changed: %@", @(loading));
    if (!loading) {
      NSLog(@"   - Bridge finished loading bundle");
      // JavaScript 실행 확인을 위해 잠시 후 루트 뷰 확인
      dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.5 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
        [self checkReactRootView];
      });
    }
  } else if ([keyPath isEqualToString:@"valid"]) {
    BOOL valid = [change[NSKeyValueChangeNewKey] boolValue];
    NSLog(@"🔍 Bridge valid state changed: %@", @(valid));
    if (valid) {
      NSLog(@"✅ Bridge is now valid - bundle loaded successfully!");
      // JavaScript 실행 확인을 위해 잠시 후 루트 뷰 확인
      dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.5 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
        [self checkReactRootView];
      });
    } else {
      NSLog(@"❌ Bridge is now invalid - bundle loading may have failed");
    }
  }
}

// React Native 루트 뷰 찾기 헬퍼 메서드
- (UIView *)findReactRootView:(UIView *)view
{
  if ([view isKindOfClass:NSClassFromString(@"RCTRootView")]) {
    return view;
  }
  for (UIView *subview in view.subviews) {
    UIView *result = [self findReactRootView:subview];
    if (result) {
      return result;
    }
  }
  return nil;
}

// React Native 루트 뷰 상태 확인
- (void)checkReactRootView
{
  UIViewController *rootViewController = [UIApplication sharedApplication].keyWindow.rootViewController;
  if (rootViewController && rootViewController.view) {
    UIView *reactRootView = [self findReactRootView:rootViewController.view];
    if (reactRootView) {
      NSLog(@"🔍 React Native root view status:");
      NSLog(@"   - Frame: %@", NSStringFromCGRect(reactRootView.frame));
      NSLog(@"   - Bounds: %@", NSStringFromCGRect(reactRootView.bounds));
      NSLog(@"   - Subviews count: %lu", (unsigned long)reactRootView.subviews.count);
      NSLog(@"   - Hidden: %@", @(reactRootView.hidden));
      NSLog(@"   - Alpha: %f", reactRootView.alpha);
      
      // 서브뷰 상세 정보
      for (NSUInteger i = 0; i < reactRootView.subviews.count; i++) {
        UIView *subview = reactRootView.subviews[i];
        NSLog(@"   - Subview[%lu]: %@, frame: %@", (unsigned long)i, NSStringFromClass([subview class]), NSStringFromCGRect(subview.frame));
      }
      
      if (reactRootView.subviews.count == 0) {
        NSLog(@"⚠️ React Native root view has no subviews - JavaScript may not be rendering");
      }
    } else {
      NSLog(@"❌ React Native root view not found");
    }
  }
}

// JavaScript 실행 상태 확인
- (void)checkJavaScriptExecution
{
  NSLog(@"🔍 Checking JavaScript execution status...");
  
  if (self.bridge) {
    NSLog(@"   - Bridge exists: YES");
    NSLog(@"   - Bridge loading: %@", @(self.bridge.loading));
    NSLog(@"   - Bridge valid: %@", @(self.bridge.valid));
    
    // React Native 루트 뷰 확인
    UIViewController *rootViewController = [UIApplication sharedApplication].keyWindow.rootViewController;
    if (rootViewController && rootViewController.view) {
      UIView *reactRootView = [self findReactRootView:rootViewController.view];
      if (reactRootView) {
        NSLog(@"   - React root view exists: YES");
        NSLog(@"   - React root view subviews count: %lu", (unsigned long)reactRootView.subviews.count);
        
        // 서브뷰가 있는지 확인 (JavaScript가 렌더링되었는지)
        if (reactRootView.subviews.count > 0) {
          NSLog(@"   - JavaScript appears to be rendering (subviews exist)");
          for (NSUInteger i = 0; i < reactRootView.subviews.count; i++) {
            UIView *subview = reactRootView.subviews[i];
            NSLog(@"   - Subview[%lu]: %@, frame: %@", (unsigned long)i, NSStringFromClass([subview class]), NSStringFromCGRect(subview.frame));
            
            // RCTRootContentView의 서브뷰 확인 (실제 React 컴포넌트)
            if ([NSStringFromClass([subview class]) isEqualToString:@"RCTRootContentView"]) {
              NSLog(@"   - RCTRootContentView subviews count: %lu", (unsigned long)subview.subviews.count);
              for (NSUInteger j = 0; j < subview.subviews.count; j++) {
                UIView *contentSubview = subview.subviews[j];
                NSLog(@"   - RCTRootContentView.Subview[%lu]: %@, frame: %@", (unsigned long)j, NSStringFromClass([contentSubview class]), NSStringFromCGRect(contentSubview.frame));
                
                // 더 깊이 확인 (최대 3단계)
                if (contentSubview.subviews.count > 0) {
                  NSLog(@"   - RCTRootContentView.Subview[%lu] has %lu subviews", (unsigned long)j, (unsigned long)contentSubview.subviews.count);
                  for (NSUInteger k = 0; k < MIN(5, contentSubview.subviews.count); k++) {
                    UIView *deepSubview = contentSubview.subviews[k];
                    NSLog(@"   - RCTRootContentView.Subview[%lu].Subview[%lu]: %@", (unsigned long)j, (unsigned long)k, NSStringFromClass([deepSubview class]));
                  }
                }
              }
              
              // RCTRootContentView에 서브뷰가 없으면 JavaScript가 렌더링되지 않은 것
              if (subview.subviews.count == 0) {
                NSLog(@"⚠️ RCTRootContentView has no subviews - JavaScript is NOT rendering!");
                NSLog(@"   - This indicates JavaScript execution failed or root component is not rendering");
                NSLog(@"   - Attempting to reload Bridge to force JavaScript execution...");
                
                // Bridge를 강제로 reload하여 JavaScript 실행 시도
                dispatch_async(dispatch_get_main_queue(), ^{
                  if (self.bridge) {
                    NSLog(@"🔄 Reloading Bridge...");
                    [self.bridge reload];
                    
                    // 2초 후 다시 확인
                    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(2.0 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
                      [self checkJavaScriptExecution];
                    });
                  }
                });
              }
            }
          }
        } else {
          NSLog(@"⚠️ React root view has no subviews - JavaScript may not be executing");
          NSLog(@"   - This could indicate:");
          NSLog(@"     1. JavaScript bundle failed to load");
          NSLog(@"     2. JavaScript execution error");
          NSLog(@"     3. Root component not rendering");
        }
      } else {
        NSLog(@"   - React root view exists: NO");
      }
    }
    
    // JavaScript console.log가 나타나지 않는다면 실행되지 않았을 수 있음
    NSLog(@"   - Note: If JavaScript console.log messages (🚀) are not appearing in Xcode console,");
    NSLog(@"     JavaScript may not be executing properly");
  } else {
    NSLog(@"   - Bridge exists: NO");
  }
}

- (NSURL *)bundleURL
{
#if DEBUG
  // WidgetKit 메시지 수신 후 앱 실행 시 Metro 연결이 느릴 수 있음
  // "could not connect to development server" 에러 방지를 위해
  // WidgetKit 메시지 수신 후 실행이면 로컬 번들을 우선 사용
  
  NSString *bundleRoot = @"index";
  
  // WidgetKit 메시지 수신 후 실행인지 확인 (App Group에 데이터가 있으면)
  NSUserDefaults *sharedDefaults = [[NSUserDefaults alloc] initWithSuiteName:@"group.mannachurch.meditationblossom"];
  BOOL hasWidgetKitData = NO;
  if (sharedDefaults) {
    NSString *displaySermon = [sharedDefaults stringForKey:@"displaySermon"];
    NSString *fcmSermon = [sharedDefaults stringForKey:@"fcm_sermon"];
    hasWidgetKitData = (displaySermon != nil || fcmSermon != nil);
  }
  
  if (hasWidgetKitData) {
    // WidgetKit 메시지 수신 후 실행이면 로컬 번들 우선 사용
    // Metro 연결 실패로 인한 빈 화면 문제 방지
    NSLog(@"⚠️ WidgetKit push data detected - using local bundle to avoid Metro connection issues");
    NSURL *localBundle = [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
    if (localBundle) {
      NSLog(@"🔗 Using local bundle: %@", localBundle);
      return localBundle;
    }
    // 로컬 번들이 없으면 Metro URL 시도
    NSLog(@"⚠️ Local bundle not found - falling back to Metro URL");
  }
  
  // 일반 실행이면 Metro URL 사용
  NSURL *metroURL = [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:bundleRoot];
  NSLog(@"🔗 Metro bundle URL (RCTBundleURLProvider): %@", metroURL);
  
  if (metroURL && [metroURL.scheme isEqualToString:@"http"]) {
    return metroURL;
  }
  
  // 폴백: 하드코딩된 IP 주소 사용
  NSString *jsLocation = @"172.30.1.25";
  NSNumber *port = @8081;
  NSString *urlString = [NSString stringWithFormat:@"http://%@:%@/%@.bundle?platform=ios&dev=true&minify=false", 
                         jsLocation, port, bundleRoot];
  NSURL *directURL = [NSURL URLWithString:urlString];
  NSLog(@"🔗 Fallback Metro bundle URL (hardcoded): %@", directURL);
  
  // 최종 폴백: 로컬 번들 사용
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
  
  // retrieve the current interfaces - returns 0 on success
  success = getifaddrs(&interfaces);
  if (success == 0) {
    // Loop through linked list of interfaces
    temp_addr = interfaces;
    while(temp_addr != NULL) {
      if(temp_addr->ifa_addr->sa_family == AF_INET) {
        // Check if interface is en0 which is the wifi connection on the iPhone
        NSString *interfaceName = [NSString stringWithUTF8String:temp_addr->ifa_name];
        if ([interfaceName isEqualToString:@"en0"] || [interfaceName hasPrefix:@"en"]) {
          // Get NSString from C String
          NSString *address = [NSString stringWithUTF8String:inet_ntoa(((struct sockaddr_in *)temp_addr->ifa_addr)->sin_addr)];
          if (![address isEqualToString:@"127.0.0.1"] && ![address hasPrefix:@"169.254"]) {
            [addresses addObject:address];
          }
        }
      }
      temp_addr = temp_addr->ifa_next;
    }
  }
  
  // Free memory
  freeifaddrs(interfaces);
  
  return addresses;
}


#pragma mark - Firebase Messaging

- (void)messaging:(FIRMessaging *)messaging didReceiveRegistrationToken:(NSString *)fcmToken {
  NSLog(@"🔥 FCM registration token: %@", fcmToken);
  // 토픽 구독은 APNS 토큰을 받은 후 didRegisterForRemoteNotificationsWithDeviceToken에서 수행
}

// 앱이 포그라운드에 있을 때 FCM 메시지 수신
- (void)application:(UIApplication *)application didReceiveRemoteNotification:(NSDictionary *)userInfo {
  NSLog(@"=== FCM MESSAGE RECEIVED (FOREGROUND) - didReceiveRemoteNotification ===");
  NSLog(@"UserInfo: %@", userInfo);
  NSLog(@"All keys in UserInfo: %@", [userInfo allKeys]);
  
  // WidgetKit Push Notifications 확인
  // 여러 위치에서 widgetkit 확인 (Firebase가 구조를 변경할 수 있음)
  NSDictionary *widgetkit = userInfo[@"widgetkit"];
  
  // aps 안에서도 확인
  if (!widgetkit) {
    NSDictionary *aps = userInfo[@"aps"];
    if (aps) {
      widgetkit = aps[@"widgetkit"];
    }
  }
  
  // data 안에서도 확인
  if (!widgetkit) {
    NSDictionary *data = userInfo[@"data"];
    if (data) {
      widgetkit = data[@"widgetkit"];
    }
  }
  
  if (widgetkit && [widgetkit[@"kind"] isEqualToString:@"MeditationBlossomWidget"]) {
    NSLog(@"🎯 WidgetKit Push Notification detected in AppDelegate (foreground)");
    NSDictionary *widgetkitData = widgetkit[@"data"];
    if (widgetkitData) {
      NSLog(@"✅ Using widgetkit.data for WidgetKit Push");
      // widgetkit.data를 사용하여 저장 (일반 userInfo 대신)
      [self saveFcmSermon:widgetkitData];
      return;
    }
  }
  
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
  NSLog(@"🔥 APNS device token received");
  [FIRMessaging messaging].APNSToken = deviceToken;
  NSLog(@"🔥 FCM APNS token set");
  
  // APNS 토큰을 받은 후 토픽 구독
  [[FIRMessaging messaging] subscribeToTopic:@"sermon_events" completion:^(NSError * _Nullable error) {
    if (error) {
      NSLog(@"Failed to subscribe to sermon_events topic: %@", error);
    } else {
      NSLog(@"Successfully subscribed to sermon_events topic");
    }
  }];
  
  // qt_events 토픽도 구독
  [[FIRMessaging messaging] subscribeToTopic:@"qt_events" completion:^(NSError * _Nullable error) {
    if (error) {
      NSLog(@"Failed to subscribe to qt_events topic: %@", error);
    } else {
      NSLog(@"Successfully subscribed to qt_events topic");
    }
  }];
  
  
  // DEBUG 모드에서만 test 토픽들 구독
#ifdef DEBUG
  [[FIRMessaging messaging] subscribeToTopic:@"sermon_events_test" completion:^(NSError * _Nullable error) {
    if (error) {
      NSLog(@"[DEBUG] Failed to subscribe to sermon_events_test topic: %@", error);
    } else {
      NSLog(@"[DEBUG] Successfully subscribed to sermon_events_test topic");
    }
  }];
  
  [[FIRMessaging messaging] subscribeToTopic:@"qt_events_test" completion:^(NSError * _Nullable error) {
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
  
  // WidgetKit Push Notifications 확인
  // 여러 위치에서 widgetkit 확인 (Firebase가 구조를 변경할 수 있음)
  NSDictionary *widgetkit = userInfo[@"widgetkit"];
  
  // aps 안에서도 확인
  if (!widgetkit) {
    NSDictionary *aps = userInfo[@"aps"];
    if (aps) {
      widgetkit = aps[@"widgetkit"];
    }
  }
  
  // data 안에서도 확인
  if (!widgetkit) {
    NSDictionary *data = userInfo[@"data"];
    if (data) {
      widgetkit = data[@"widgetkit"];
    }
  }
  
  if (widgetkit && [widgetkit[@"kind"] isEqualToString:@"MeditationBlossomWidget"]) {
    NSLog(@"🎯 WidgetKit Push Notification detected in AppDelegate (background)");
    NSDictionary *widgetkitData = widgetkit[@"data"];
    if (widgetkitData) {
      NSLog(@"✅ Using widgetkit.data for WidgetKit Push");
      // widgetkit.data를 사용하여 저장 (일반 userInfo 대신)
      [self saveFcmSermon:widgetkitData];
      completionHandler(UIBackgroundFetchResultNewData);
      return;
    }
  }
  
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

- (void)saveToAsyncStorageDirect:(NSString *)jsonString forKey:(NSString *)key {
#if __has_include(<RNCAsyncStorage/RNCAsyncStorage.h>) || __has_include("RNCAsyncStorage.h")
  if (!jsonString || !key) {
    NSLog(@"❌ AsyncStorage save skipped: key or value is nil");
    return;
  }

  RNCAsyncStorage *storage = [RNCAsyncStorage new];

  dispatch_async(storage.methodQueue, ^{
    [storage multiSet:@[@[key, jsonString]]
             callback:^(NSArray *response) {
      id error = (response.count > 0) ? response[0] : nil;

      if (error && error != [NSNull null]) {
        NSLog(@"❌ AsyncStorage direct save failed for key %@: %@", key, error);
      } else {
        NSLog(@"✅ AsyncStorage direct save success for key %@", key);
      }
    }];
  });
#else
  NSLog(@"⚠️ RNCAsyncStorage header not found. AsyncStorage direct save skipped.");
#endif
}

- (NSString *)asyncStorageKeyForFCMData:(NSDictionary *)data {
  NSString *topic = [NSString stringWithFormat:@"%@", data[@"topic"] ?: @""].lowercaseString;

  // fcm 타입 분기
  if ([topic containsString:@"qt"]) {
    // qt일 경우
    return @"fcm_qt";
  }
  else if ([topic containsString:@"sermon"]) {
    // 설교일 경우
    return @"fcm_sermon";
  }
  else {
    // 예외
    return nil;
  }
}

// 설교 이벤트 처리 헬퍼 메서드
- (void)saveFcmSermon:(NSDictionary *)data {
  NSLog(@"=== PROCESSING SERMON EVENT ===");
  NSLog(@"Event data: %@", data);
  
  // id가 없으면 gcm.message_id를 사용
  NSString *sourceId = data[@"source_id"];
  if (!sourceId) {
    id messageId = data[@"gcm.message_id"];
    sourceId = [NSString stringWithFormat:@"%@", messageId];
  }
  
  // content 필드 확인 및 로깅
//  NSString *contentValue = data[@"content"];
//  NSLog(@"📝 Content length: %lu characters", (unsigned long)[contentValue length]);
//  NSLog(@"📝 Content preview (first 200 chars): %@", [contentValue substringToIndex:MIN(200, [contentValue length])]);
  
  // AsyncStorage 키 파싱
  NSString *storageKey = [self asyncStorageKeyForFCMData:data];
  if (storageKey == nil) {
    NSLog(@"Failed to get topic type");
    return;
  }
  
  // 나머지 데이터 파싱
  NSMutableDictionary *sermonData = [@{
      @"source_id": sourceId ?: @"",
      @"title": data[@"title"] ?: @"",
      @"category": data[@"category"] ?: @"",
      @"bible_references": data[@"bible_references"] ?: @"",
      @"meditation_questions": data[@"meditation_questions"] ?: @"",
      @"date": data[@"date"] ?: @"",
      @"year": data[@"year"] ?: @"",
      @"day_of_week": data[@"day_of_week"] ?: @"",
      @"video_url": @"", // url이 없는 경우를 대비 일단 빈 문자열 처리
      @"created_at": data[@"created_at"] ?: @"",
      @"updated_at": data[@"updated_at"] ?: @"",
      @"operation": data[@"operation"] ?: @"",
      @"topic": data[@"topic"] ?: @""
  } mutableCopy];
  
  // 영상이 있을 경우에만 url에 추가
  if (data[@"video_url"]) {
      sermonData[@"video_url"] = data[@"video_url"];
  }
  
  NSError *error;
  NSData *jsonData = [NSJSONSerialization dataWithJSONObject:sermonData options:0 error:&error];
  if (jsonData) {
    NSString *jsonString = [[NSString alloc] initWithData:jsonData encoding:NSUTF8StringEncoding];
    
    // JSON 문자열의 content 확인
    NSLog(@"📝 JSON string length: %lu characters", (unsigned long)[jsonString length]);
    
    // 1. App Group에 저장 (위젯용)
    NSUserDefaults *sharedDefaults = [[NSUserDefaults alloc] initWithSuiteName:@"group.mannachurch.meditationblossom"];
    // [sharedDefaults setObject:jsonString forKey:@"fcm_sermon"];
    [sharedDefaults setObject:jsonString forKey:storageKey];
    [sharedDefaults setObject:jsonString forKey:@"displaySermon"];
    [sharedDefaults synchronize];
    
    // 저장된 데이터 확인
    // NSString *savedData = [sharedDefaults stringForKey:@"fcm_sermon"];
    NSString *savedData = [sharedDefaults stringForKey:storageKey];
    NSLog(@"📝 Saved data length in UserDefaults: %lu characters", (unsigned long)[savedData length]);
    NSLog(@"✅ Successfully saved FCM sermon to App Group");
    
    [self saveToAsyncStorageDirect:jsonString forKey:storageKey];
    
    // 위젯 즉시 업데이트 (Swift 모듈 사용)
    [WidgetUpdateModule reloadWidgets];
    
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
  
  // sermon_events 토픽인지 확인하고 데이터 처리
  NSString *topic = userInfo[@"topic"];
  if (topic && ([topic isEqualToString:@"sermon_events"]
#ifdef DEBUG
                || [topic isEqualToString:@"sermon_events_test"]
#endif
                )) {
    NSLog(@"✅ Processing sermon_events notification tap");
    [self saveFcmSermon:userInfo];
  } else {
    NSLog(@"ℹ️ Notification not from sermon_events topic, skipping");
  }
  
  completionHandler();
  }
  
// App Group 데이터 확인 및 위젯 리로드 (Bridge 초기화 완료 후 호출)
- (void)checkWidgetKitPushDataAndReloadWidgets {
  NSLog(@"🔍 Checking App Group data after Bridge initialization...");
  
  // App Group 데이터 확인 (앱이 종료된 상태에서 widgetkit push로 받은 데이터)
  NSUserDefaults *sharedDefaults = [[NSUserDefaults alloc] initWithSuiteName:@"group.mannachurch.meditationblossom"];
  if (sharedDefaults) {
    NSString *displaySermon = [sharedDefaults stringForKey:@"displaySermon"];
    NSString *fcmSermon = [sharedDefaults stringForKey:@"fcm_sermon"];
    NSLog(@"🎯 App Group data check on launch:");
    NSLog(@"   - displaySermon exists: %@ (%lu chars)", displaySermon ? @"YES" : @"NO", (unsigned long)[displaySermon length]);
    NSLog(@"   - fcm_sermon exists: %@ (%lu chars)", fcmSermon ? @"YES" : @"NO", (unsigned long)[fcmSermon length]);
    
    if (displaySermon || fcmSermon) {
      NSLog(@"✅ WidgetKit push data found in App Group (app was terminated when push received)");
      NSLog(@"✅ This means NotificationService extension saved data while app was terminated");
      if (displaySermon) {
        NSLog(@"   - displaySermon preview (first 200 chars): %@", [displaySermon substringToIndex:MIN(200, [displaySermon length])]);
      }
      
      // Bridge가 완전히 준비된 후 위젯 타임라인 리로드
      // 약간의 지연을 두어 React Native가 완전히 준비될 시간을 줌
      dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.5 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
        NSLog(@"🔄 Reloading widget timelines after app restart (WidgetKit push data detected)...");
        NSLog(@"   - Bridge is ready, safe to reload widgets");
        [WidgetUpdateModule reloadWidgets];
        NSLog(@"✅ Widget timelines reload requested");
        
        // 약간의 지연 후 한 번 더 리로드 (시스템이 위젯을 업데이트할 시간을 줌)
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(1.0 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
          NSLog(@"🔄 Reloading widget timelines again after 1 second...");
          [WidgetUpdateModule reloadWidgets];
        });
      });
    } else {
      NSLog(@"❌ No WidgetKit push data found in App Group on launch");
      NSLog(@"❌ This could mean:");
      NSLog(@"   1. NotificationService extension was not executed while app was terminated");
      NSLog(@"   2. WidgetKit push was not received");
      NSLog(@"   3. NotificationService extension failed to save data");
    }
  } else {
    NSLog(@"❌ Failed to access App Group UserDefaults on launch");
  }
}
  
@end
