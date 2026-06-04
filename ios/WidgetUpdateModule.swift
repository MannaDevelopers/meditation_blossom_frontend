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
    static let fcmQtKey = "fcm_qt"
    static let youtubeLinkEnabledKey = "youtube_link_enabled"
  }

  private static func appGroupDefaults() -> UserDefaults? {
    UserDefaults(suiteName: Constants.appGroupId)
  }

  // MARK: - Sermon

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

  // MARK: - QT

  @objc
  func onQtUpdated(_ qtData: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let sharedDefaults = Self.appGroupDefaults() else {
      reject("APP_GROUP_ERROR", "App Group을 찾을 수 없습니다.", nil)
      return
    }
    sharedDefaults.set(qtData, forKey: Constants.fcmQtKey)
    WidgetCenter.shared.reloadAllTimelines()
    resolve(true)
  }

  // MARK: - Bible References

  @objc
  func resolveBibleReferences(_ jsonString: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    NSLog("📖 resolveBibleReferences called, input: %@", String(jsonString.prefix(100)))
    DispatchQueue.global(qos: .userInitiated).async {
      do {
        guard let data = jsonString.data(using: .utf8),
              let refs = try JSONSerialization.jsonObject(with: data) as? [[String: Any]],
              !refs.isEmpty else {
          NSLog("📖 resolveBibleReferences: empty refs or parse failed → returning empty")
          resolve("")
          return
        }

        NSLog("📖 resolveBibleReferences: %d refs to process", refs.count)
        let helper = BibleDbHelper.shared
        var lines: [String] = []

        for ref in refs {
          guard let book = ref["book"] as? String,
                let chapter = ref["chapter"] as? Int,
                // Firestore/FCM 모두 snake_case 키(verse_start/verse_end) 사용
                let fromVerse = ref["verse_start"] as? Int else {
            NSLog("📖 resolveBibleReferences: skipping ref with missing keys: %@", ref.description)
            continue
          }
          let toVerse = ref["verse_end"] as? Int ?? fromVerse
          NSLog("📖 querying %@ %d:%d-%d", book, chapter, fromVerse, toVerse)

          let text = helper.getVerses(book: book, chapter: chapter, verseStart: fromVerse, verseEnd: toVerse)
          NSLog("📖 result: %@", text.isEmpty ? "(empty)" : String(text.prefix(50)))
          if !text.isEmpty {
            lines.append(text)
          }
        }

        let result = lines.joined(separator: "\n\n")
        NSLog("📖 resolveBibleReferences done: %d chars", result.count)
        resolve(result)
      } catch {
        NSLog("📖 resolveBibleReferences error: %@", error.localizedDescription)
        reject("BIBLE_RESOLVE_ERROR", error.localizedDescription, error)
      }
    }
  }

  // MARK: - App Group

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

  // MARK: - YouTube Link Preference

  @objc
  func getYoutubeLinkEnabled(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let sharedDefaults = Self.appGroupDefaults() else {
      reject("APP_GROUP_ERROR", "App Group을 찾을 수 없습니다.", nil)
      return
    }
    let enabled = sharedDefaults.bool(forKey: Constants.youtubeLinkEnabledKey)
    resolve(enabled)
  }

  @objc
  func setYoutubeLinkEnabled(_ enabled: Bool, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let sharedDefaults = Self.appGroupDefaults() else {
      reject("APP_GROUP_ERROR", "App Group을 찾을 수 없습니다.", nil)
      return
    }
    sharedDefaults.set(enabled, forKey: Constants.youtubeLinkEnabledKey)
    WidgetCenter.shared.reloadAllTimelines()
    resolve(nil)
  }

  // MARK: - Clear

  @objc
  func onClear(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let sharedDefaults = Self.appGroupDefaults() else {
      reject("APP_GROUP_ERROR", "App Group을 찾을 수 없습니다.", nil)
      return
    }

    sharedDefaults.removeObject(forKey: Constants.displaySermonKey)
    sharedDefaults.removeObject(forKey: Constants.fcmSermonKey)
    sharedDefaults.removeObject(forKey: Constants.fcmQtKey)
    sharedDefaults.synchronize()

    WidgetCenter.shared.reloadAllTimelines()

    resolve("Cleared successfully")
  }

  // MARK: - Static Helpers

  @objc
  static func reloadWidgets() {
    WidgetCenter.shared.reloadAllTimelines()
  }

  @objc
  static func requiresMainQueueSetup() -> Bool {
    return true
  }
}
