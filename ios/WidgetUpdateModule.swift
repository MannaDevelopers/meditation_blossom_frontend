import Foundation
import WidgetKit
import React

@objc(WidgetUpdateModule)
class WidgetUpdateModule: NSObject {
  @objc
  func onSermonUpdated(_ sermonData: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    // AppGroup에 접근
    guard let sharedDefaults = UserDefaults(suiteName: "group.com.Blossom.MeditationBlossom") else {
      reject("APP_GROUP_ERROR", "App Group을 찾을 수 없습니다.", nil)
      return
    }
    sharedDefaults.set(sermonData, forKey: "displaySermon")
    WidgetCenter.shared.reloadAllTimelines()
  }
  
  @objc
  static func requiresMainQueueSetup() -> Bool {
    return true
  }
} 
