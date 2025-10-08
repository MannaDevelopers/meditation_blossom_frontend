import Foundation
import WidgetKit

typealias RCTPromiseResolveBlock = @convention(block) (Any?) -> Void
typealias RCTPromiseRejectBlock = @convention(block) (String, String, Error?) -> Void

@objc(WidgetUpdateModule)
class WidgetUpdateModule: NSObject {
  @objc
  func onSermonUpdated(_ sermonData: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    // AppGroup에 접근 - 위젯과 동일한 App Group 사용
    guard let sharedDefaults = UserDefaults(suiteName: "group.org.mannamethodistchurch.mannadev.meditationblossom") else {
      reject("APP_GROUP_ERROR", "App Group을 찾을 수 없습니다.", nil)
      return
    }
    // 위젯에서 읽는 키와 동일한 키 사용
    sharedDefaults.set(sermonData, forKey: "displaySermon")
    WidgetCenter.shared.reloadAllTimelines()
    resolve("Widget updated successfully")
  }
  
  @objc
  func getAppGroupData(_ key: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let sharedDefaults = UserDefaults(suiteName: "group.org.mannamethodistchurch.mannadev.meditationblossom") else {
      reject("APP_GROUP_ERROR", "App Group을 찾을 수 없습니다.", nil)
      return
    }
    
    if let value = sharedDefaults.string(forKey: key) {
      resolve(value)
    } else {
      resolve(nil)
    }
  }
  
  @objc
  func onClear(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let sharedDefaults = UserDefaults(suiteName: "group.org.mannamethodistchurch.mannadev.meditationblossom") else {
      reject("APP_GROUP_ERROR", "App Group을 찾을 수 없습니다.", nil)
      return
    }
    
    // App Group의 모든 설교 데이터 삭제
    sharedDefaults.removeObject(forKey: "displaySermon")
    sharedDefaults.removeObject(forKey: "fcm_sermon")
    sharedDefaults.synchronize()
    
    // 위젯 업데이트
    WidgetCenter.shared.reloadAllTimelines()
    
    resolve("Cleared successfully")
  }
  
  @objc
  static func requiresMainQueueSetup() -> Bool {
    return true
  }
} 
