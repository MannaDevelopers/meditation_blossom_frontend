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
  return @[@"MyEvent"];
}

// RN 0.65+ 규약: 리스너 카운트 관리 (없어도 동작은 하지만 경고 방지)
- (void)startObserving
{
  hasListeners = YES;
}

- (void)stopObserving
{
  hasListeners = NO;
}

- (void)addListener:(NSString *)eventName {}
- (void)removeListeners:(double)count {}

#pragma mark - Public APIs (JS에서 호출 가능)

RCT_EXPORT_METHOD(trigger:(NSString *)message)
{
  if (!hasListeners) { return; }
  if (message == nil) { message = @""; }
  [self sendEventWithName:@"MyEvent" body:@{ @"message": message }];
}

@end

