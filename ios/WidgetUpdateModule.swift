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

  // DB 조회를 직렬화하기 위한 전용 큐 (SQLite 멀티스레드 에러 방지)
  private static let dbQueue = DispatchQueue(label: "com.mannachurch.BibleDbHelper", qos: .userInitiated)

  @objc
  func resolveBibleReferences(_ jsonString: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    NSLog("📖 resolveBibleReferences called, input: %@", String(jsonString.prefix(120)))
    WidgetUpdateModule.dbQueue.async {
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
        var resultParts: [String] = []

        for ref in refs {
          guard let book = ref["book"] as? String,
                let chapter = ref["chapter"] as? Int,
                let fromVerse = ref["verse_start"] as? Int else {
            NSLog("📖 skipping ref with missing book/chapter/verse_start keys")
            continue
          }
          let toVerse = ref["verse_end"] as? Int ?? fromVerse
          let rangeStr = fromVerse == toVerse ? "\(chapter):\(fromVerse)" : "\(chapter):\(fromVerse)-\(toVerse)"

          // 서버가 verses 배열로 본문을 미리 제공하면 DB 조회 불필요
          var verseBodyLines: [String] = []
          if let verses = ref["verses"] as? [[String: Any]], !verses.isEmpty {
            NSLog("📖 using embedded verses for %@ %@", book, rangeStr)
            for verse in verses {
              guard let content = verse["content"] as? String, !content.isEmpty else { continue }
              if let num = verse["verse_number"] as? Int {
                verseBodyLines.append("\(num) \(content)")
              } else {
                verseBodyLines.append(content)
              }
            }
          }

          // embedded verses 없으면 bible.db 직접 조회
          if verseBodyLines.isEmpty {
            NSLog("📖 querying DB for %@ %@", book, rangeStr)
            let text = helper.getVerses(book: book, chapter: chapter, verseStart: fromVerse, verseEnd: toVerse)
            NSLog("📖 DB result: %@", text.isEmpty ? "(empty)" : String(text.prefix(50)))
            if !text.isEmpty {
              verseBodyLines = text.components(separatedBy: "\n").filter { !$0.isEmpty }
            }
          }

          if verseBodyLines.isEmpty { continue }

          // Android BibleReferenceResolver와 동일한 포맷:
          // "본문 : 사무엘상 17:31-37 31 어떤 사람이..."
          // extractContent(sermonParser.ts)가 이 포맷을 파싱한다.
          let verseBody = verseBodyLines.joined(separator: " ")
          resultParts.append("본문 : \(book) \(rangeStr) \(verseBody)")
        }

        let result = resultParts.joined(separator: "\n\n")
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
