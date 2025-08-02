#import <RCTAppDelegate.h>
#import <UIKit/UIKit.h>
//#import <FirebaseCore>
#import <FirebaseCore/FirebaseCore.h>
#import <FirebaseMessaging/FirebaseMessaging.h>
#import <UserNotifications/UserNotifications.h>

@interface AppDelegate : RCTAppDelegate <FIRMessagingDelegate, UNUserNotificationCenterDelegate>

@end
