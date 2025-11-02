#import <RCTAppDelegate.h>
#import <UIKit/UIKit.h>
#import <FirebaseCore/FirebaseCore.h>
#import <FirebaseMessaging/FirebaseMessaging.h>
#import <FirebaseInAppMessaging/FirebaseInAppMessaging.h>
#import <UserNotifications/UserNotifications.h>

@interface AppDelegate : RCTAppDelegate <FIRMessagingDelegate, UNUserNotificationCenterDelegate>

@end
