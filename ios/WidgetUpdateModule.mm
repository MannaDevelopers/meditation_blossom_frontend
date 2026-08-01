#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>
#import <ReactCodegen/AppSpecs/AppSpecs.h>

#import "meditation_blossom-Swift.h"

NS_ASSUME_NONNULL_BEGIN

@interface WidgetUpdateModule : NativeWidgetUpdateModuleSpecBase <NativeWidgetUpdateModuleSpec>
@end

@implementation WidgetUpdateModule {
  WidgetUpdateModuleImpl *_impl;
}

RCT_EXPORT_MODULE(WidgetUpdateModule)

- (instancetype)init
{
  if (self = [super init]) {
    _impl = [WidgetUpdateModuleImpl new];
  }
  return self;
}

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:(const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeWidgetUpdateModuleSpecJSI>(params);
}

- (void)onSermonUpdated:(NSString *)sermonData
                 resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject
{
  [_impl onSermonUpdated:sermonData resolver:resolve rejecter:reject];
}

- (void)onQtUpdated:(NSString *)qtData
             resolve:(RCTPromiseResolveBlock)resolve
              reject:(RCTPromiseRejectBlock)reject
{
  [_impl onQtUpdated:qtData resolver:resolve rejecter:reject];
}

- (void)resolveBibleReferences:(NSString *)jsonString
                        resolve:(RCTPromiseResolveBlock)resolve
                         reject:(RCTPromiseRejectBlock)reject
{
  [_impl resolveBibleReferences:jsonString resolver:resolve rejecter:reject];
}

- (void)onClear:(RCTPromiseResolveBlock)resolve
         reject:(RCTPromiseRejectBlock)reject
{
  [_impl onClear:resolve rejecter:reject];
}

- (void)getAppGroupData:(NSString *)key
                 resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject
{
  [_impl getAppGroupData:key resolver:resolve rejecter:reject];
}

- (void)setYoutubeLinkEnabled:(BOOL)enabled
                       resolve:(RCTPromiseResolveBlock)resolve
                        reject:(RCTPromiseRejectBlock)reject
{
  [_impl setYoutubeLinkEnabled:enabled resolver:resolve rejecter:reject];
}

- (void)getYoutubeLinkEnabled:(RCTPromiseResolveBlock)resolve
                        reject:(RCTPromiseRejectBlock)reject
{
  [_impl getYoutubeLinkEnabled:resolve rejecter:reject];
}

@end

NS_ASSUME_NONNULL_END
