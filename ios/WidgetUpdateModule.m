#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(WidgetUpdateModule, NSObject)

RCT_EXTERN_METHOD(onSermonUpdated:(NSString *)sermonData
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getAppGroupData:(NSString *)key
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(onClear:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end 