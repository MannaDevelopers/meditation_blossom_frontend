#import <RCTAppDelegate.h>
#import <UIKit/UIKit.h>
#import <FirebaseCore/FirebaseCore.h>
#import <FirebaseMessaging/FirebaseMessaging.h>
#import <FirebaseInAppMessaging/FirebaseInAppMessaging.h>
#import <UserNotifications/UserNotifications.h>
// 디버깅용 imports (테스트 완료 후 주석 처리)
// #import <FirebaseAnalytics/FirebaseAnalytics.h>
// #import <FirebaseInstallations/FirebaseInstallations.h>

@interface AppDelegate : RCTAppDelegate <FIRMessagingDelegate, UNUserNotificationCenterDelegate>

@end
