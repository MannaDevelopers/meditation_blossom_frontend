//
//  MyEventModule.m
//  meditation_blossom
//
//  Created by 최상준 on 8/14/25.
//

// MyEventModule.m
#import <React/RCTEventEmitter.h>
#import <React/RCTBridgeModule.h>

// AppDelegate가 이 이름으로 NSNotification을 post하면
// MyEventModule이 받아서 JS에 emit한다.
// self.bridge 의존 없이 New Architecture에서도 동작.
NSString *const FCMSermonUpdateNotification = @"FCM_SERMON_UPDATE_INTERNAL";
NSString *const FCMQtUpdateNotification     = @"FCM_QT_UPDATE_INTERNAL";

@interface MyEventModule : RCTEventEmitter <RCTBridgeModule>
@end

@implementation MyEventModule

#pragma mark - Module Registration

// JS에서 NativeModules.MyEventModule로 보이게 등록
RCT_EXPORT_MODULE(MyEventModule);

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

#pragma mark - Lifecycle

- (instancetype)init
{
  self = [super init];
  if (self) {
    [[NSNotificationCenter defaultCenter] addObserver:self
                                             selector:@selector(onSermonUpdate)
                                                 name:FCMSermonUpdateNotification
                                               object:nil];
    [[NSNotificationCenter defaultCenter] addObserver:self
                                             selector:@selector(onQtUpdate)
                                                 name:FCMQtUpdateNotification
                                               object:nil];
  }
  return self;
}

- (void)dealloc
{
  [[NSNotificationCenter defaultCenter] removeObserver:self];
}

#pragma mark - NSNotification handlers

- (void)onSermonUpdate
{
  [self sendEventWithName:@"ON_SERMON_UPDATE" body:@{@"message": @"FCM sermon update"}];
}

- (void)onQtUpdate
{
  [self sendEventWithName:@"ON_QT_UPDATE" body:@{@"message": @"FCM qt update"}];
}

#pragma mark - RCTEventEmitter overrides

// JS에서 구독할 이벤트 이름 목록
- (NSArray<NSString *> *)supportedEvents
{
  return @[@"ON_SERMON_UPDATE", @"ON_QT_UPDATE"];
}

- (void)startObserving {}
- (void)stopObserving  {}

#pragma mark - Public APIs (JS에서 직접 호출 가능)

RCT_EXPORT_METHOD(trigger:(NSString *)message)
{
  [self sendEventWithName:@"ON_SERMON_UPDATE" body:@{@"message": message ?: @""}];
}

RCT_EXPORT_METHOD(triggerQtUpdate:(NSString *)message)
{
  [self sendEventWithName:@"ON_QT_UPDATE" body:@{@"message": message ?: @""}];
}

@end
