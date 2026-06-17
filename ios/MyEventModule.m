//
//  MyEventModule.m
//  meditation_blossom
//
//  Created by 최상준 on 8/14/25.
//

// MyEventModule.m
#import <React/RCTEventEmitter.h>
#import <React/RCTBridgeModule.h>

@interface MyEventModule : RCTEventEmitter <RCTBridgeModule>
@end

@implementation MyEventModule
{
  BOOL hasListeners;
}

#pragma mark - Module Registration

// JS에서 NativeModules.MyEventModule로 보이게 등록
RCT_EXPORT_MODULE(MyEventModule);

+ (BOOL)requiresMainQueueSetup
{
  // UI/알림 등 메인스레드 리소스 접근 가능성을 고려해 true
  return YES;
}

#pragma mark - RCTEventEmitter overrides

// JS에서 구독할 이벤트 이름 목록
- (NSArray<NSString *> *)supportedEvents
{
  return @[@"ON_SERMON_UPDATE", @"ON_QT_UPDATE"];
}

- (void)startObserving
{
  hasListeners = YES;
}

- (void)stopObserving
{
  hasListeners = NO;
}

// addListener:/removeListeners: 를 override하지 않음.
// base class(RCTEventEmitter)가 리스너 카운트를 관리하고
// startObserving/stopObserving을 호출해 hasListeners를 올바르게 설정한다.
// 빈 override가 있으면 startObserving이 호출되지 않아 hasListeners = NO 고정 → 이벤트 폐기.

#pragma mark - Public APIs (JS에서 호출 가능)

RCT_EXPORT_METHOD(trigger:(NSString *)message)
{
  if (message == nil) { message = @""; }
  [self sendEventWithName:@"ON_SERMON_UPDATE" body:@{ @"message": message }];
}

RCT_EXPORT_METHOD(triggerQtUpdate:(NSString *)message)
{
  if (message == nil) { message = @""; }
  [self sendEventWithName:@"ON_QT_UPDATE" body:@{ @"message": message }];
}

@end

