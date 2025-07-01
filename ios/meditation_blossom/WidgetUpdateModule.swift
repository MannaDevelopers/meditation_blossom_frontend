import Foundation
import WidgetKit

@objc(WidgetUpdateModule)
class WidgetUpdateModule: NSObject {
  
  @objc
  func onSermonUpdated(_ sermonData: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
        //TODO: iOS 위젯 업데이트 로직 추가
    //   // Save to shared UserDefaults for widget access
    //   if let userDefaults = UserDefaults(suiteName: "group.com.meditation.blossom") {
    //     userDefaults.set(sermonData.data(using: .utf8), forKey: "display_sermon")
    //     userDefaults.synchronize()
        
    //     // Reload widgets after saving data
    //     WidgetCenter.shared.reloadAllTimelines()
    //     resolve(true)
    //   } else {
    //     reject("WIDGET_SAVE_ERROR", "Failed to access shared UserDefaults", nil)
    //   }
    }
  }
  
  @objc
  static func requiresMainQueueSetup() -> Bool {
    return true
  }
} 