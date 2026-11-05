#import <UIKit/UIKit.h>
#import <FirebaseCore/FirebaseCore.h>
#import <FirebaseMessaging/FirebaseMessaging.h>
#import <FirebaseInAppMessaging/FirebaseInAppMessaging.h>
#import <FirebaseAnalytics/FirebaseAnalytics.h>
#import <UserNotifications/UserNotifications.h>
// 디버깅용 imports (테스트 완료 후 주석 처리)
// #import <FirebaseInstallations/FirebaseInstallations.h>

// [#342] UIScene 전환: React Native 시작과 URL 처리는 SceneDelegate.swift로 옮겼고,
// AppDelegate는 Firebase/FCM/알림 같은 앱 단위 이벤트만 다룬다. (RCTAppDelegate는 RN 0.88에서
// deprecated이며 UIScreen 기준 window를 직접 만들기 때문에 Scene 기반 앱에서는 쓰지 않는다.)
@interface AppDelegate : UIResponder <UIApplicationDelegate, FIRMessagingDelegate, UNUserNotificationCenterDelegate>

// Scene 기반 앱에서도 `[UIApplication sharedApplication].delegate.window`를 읽는 라이브러리가 있다
// (예: RNFB Messaging의 didFinishLaunching 옵저버). 이 프로퍼티가 없으면 unrecognized selector로
// 앱이 즉시 종료되므로, 현재 연결된 Scene의 window를 돌려주는 읽기 전용 프로퍼티로 제공한다.
@property (nonatomic, readonly, nullable) UIWindow *window;

@end
