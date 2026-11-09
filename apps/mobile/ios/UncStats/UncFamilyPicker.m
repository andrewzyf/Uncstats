#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(UncFamilyPicker, NSObject)

RCT_EXTERN_METHOD(presentPicker:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
