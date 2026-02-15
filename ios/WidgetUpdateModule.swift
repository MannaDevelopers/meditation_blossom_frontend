import Foundation
import WidgetKit

typealias RCTPromiseResolveBlock = @convention(block) (Any?) -> Void
typealias RCTPromiseRejectBlock = @convention(block) (String, String, Error?) -> Void

@objc(WidgetUpdateModule)
class WidgetUpdateModule: NSObject {
  private enum Constants {
    static let appGroupId = "group.mannachurch.meditationblossom"
    static let displaySermonKey = "displaySermon"
    static let fcmSermonKey = "fcm_sermon"
  }

  private static func appGroupDefaults() -> UserDefaults? {
    UserDefaults(suiteName: Constants.appGroupId)
  }

  @objc
  func onSermonUpdated(_ sermonData: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let sharedDefaults = Self.appGroupDefaults() else {
      reject("APP_GROUP_ERROR", "App Group을 찾을 수 없습니다.", nil)
      return
    }
    sharedDefaults.set(sermonData, forKey: Constants.displaySermonKey)
    WidgetCenter.shared.reloadAllTimelines()
    resolve("Widget updated successfully")
  }

  @objc
  func getAppGroupData(_ key: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let sharedDefaults = Self.appGroupDefaults() else {
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
    guard let sharedDefaults = Self.appGroupDefaults() else {
      reject("APP_GROUP_ERROR", "App Group을 찾을 수 없습니다.", nil)
      return
    }

    sharedDefaults.removeObject(forKey: Constants.displaySermonKey)
    sharedDefaults.removeObject(forKey: Constants.fcmSermonKey)
    sharedDefaults.synchronize()

    WidgetCenter.shared.reloadAllTimelines()

    resolve("Cleared successfully")
  }

  @objc
  static func reloadWidgets() {
    WidgetCenter.shared.reloadAllTimelines()
  }

  @objc
  static func requiresMainQueueSetup() -> Bool {
    return true
  }
}
