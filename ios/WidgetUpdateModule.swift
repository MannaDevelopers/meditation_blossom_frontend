import Foundation
import WidgetKit

typealias RCTPromiseResolveBlock = @convention(block) (Any?) -> Void
typealias RCTPromiseRejectBlock = @convention(block) (String, String, Error?) -> Void

// TurboModule 프로토콜 구현은 WidgetUpdateModule.mm(ObjC++ shim)이 담당하고,
// 이 클래스는 실제 비즈니스 로직만 가진다 (RN 공식 Swift TurboModule 패턴).
@objc(WidgetUpdateModuleImpl)
class WidgetUpdateModuleImpl: NSObject {
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
    // JS Sermon 타입의 {seconds, nanoseconds} 타임스탬프를 ISO 문자열로 변환.
    // 위젯 Swift Sermon.init(from:)이 두 포맷을 모두 처리하지만,
    // Extension/AppDelegate 경로와 포맷을 통일해 크로스 프로세스 파싱 안정성을 높인다.
    let normalized = WidgetUpdateModuleImpl.normalizeTimestamps(sermonData) ?? sermonData
    sharedDefaults.set(normalized, forKey: Constants.displaySermonKey)
    sharedDefaults.synchronize()
    WidgetUpdateModuleImpl.reloadWidgets()
    resolve("Widget updated successfully")
  }

  // MARK: - Timestamp Normalization

  // JS JSON의 {seconds, nanoseconds} 타임스탬프 필드를 ISO 8601 문자열로 변환
  private static func normalizeTimestamps(_ jsonString: String) -> String? {
    guard let data = jsonString.data(using: .utf8),
          var dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
      return nil
    }
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    for key in ["created_at", "updated_at"] {
      if let ts = dict[key] as? [String: Any],
         let seconds = (ts["seconds"] as? NSNumber)?.doubleValue {
        let nanos = (ts["nanoseconds"] as? NSNumber)?.doubleValue ?? 0
        let date = Date(timeIntervalSince1970: seconds + nanos / 1_000_000_000)
        dict[key] = formatter.string(from: date)
      }
    }
    guard let normalized = try? JSONSerialization.data(withJSONObject: dict),
          let result = String(data: normalized, encoding: .utf8) else {
      return nil
    }
    return result
  }

  // MARK: - QT

  @objc
  func onQtUpdated(_ qtData: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let sharedDefaults = Self.appGroupDefaults() else {
      reject("APP_GROUP_ERROR", "App Group을 찾을 수 없습니다.", nil)
      return
    }
    sharedDefaults.set(qtData, forKey: Constants.fcmQtKey)
    sharedDefaults.synchronize()
    WidgetUpdateModuleImpl.reloadWidgets()
    resolve(true)
  }

  // MARK: - Bible References

  // DB 조회를 직렬화하기 위한 전용 큐 (SQLite 멀티스레드 에러 방지)
  private static let dbQueue = DispatchQueue(label: "com.mannachurch.BibleDbHelper", qos: .userInitiated)

  @objc
  func resolveBibleReferences(_ jsonString: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    WidgetUpdateModuleImpl.dbQueue.async {
      do {
        guard let data = jsonString.data(using: .utf8),
              let refs = try JSONSerialization.jsonObject(with: data) as? [[String: Any]],
              !refs.isEmpty else {
          resolve("")
          return
        }

        let helper = BibleDbHelper.shared
        // refs가 여러 개인 경우 Android BibleReferenceResolver와 동일하게:
        // "본문 : 참조1, 참조2 구절1 구절2" 형태로 합쳐야 extractContent가 올바르게 파싱함.
        // 각 ref를 별도의 "본문 : ..." 문자열로 만들면 두 번째 "본문 : "부터 파싱이 깨진다.
        var allRefStrings: [String] = []
        var allVerseLines: [String] = []

        for ref in refs {
          guard let book = ref["book"] as? String,
                let chapter = ref["chapter"] as? Int,
                let fromVerse = ref["verse_start"] as? Int else { continue }
          let toVerse = ref["verse_end"] as? Int ?? fromVerse
          let rangeStr = fromVerse == toVerse ? "\(chapter):\(fromVerse)" : "\(chapter):\(fromVerse)-\(toVerse)"

          // 서버가 verses 배열로 본문을 미리 제공하면 DB 조회 불필요
          var verseBodyLines: [String] = []
          if let verses = ref["verses"] as? [[String: Any]], !verses.isEmpty {
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
            let text = helper.getVerses(book: book, chapter: chapter, verseStart: fromVerse, verseEnd: toVerse)
            if !text.isEmpty {
              verseBodyLines = text.components(separatedBy: "\n").filter { !$0.isEmpty }
            }
          }

          if verseBodyLines.isEmpty { continue }

          allRefStrings.append("\(book) \(rangeStr)")
          allVerseLines.append(contentsOf: verseBodyLines)
        }

        guard !allRefStrings.isEmpty else {
          resolve("")
          return
        }

        // Android 포맷: "본문 : 참조1, 참조2 31 구절1 32 구절2 25 구절3..."
        // extractContent(sermonParser.ts)의 bookNameRegex가 쉼표 구분 참조를 지원한다.
        let reference = allRefStrings.joined(separator: ", ")
        let body = allVerseLines.joined(separator: " ")
        resolve("본문 : \(reference) \(body)")
      } catch {
        NSLog("resolveBibleReferences error: %@", error.localizedDescription)
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
    WidgetUpdateModuleImpl.reloadWidgets()
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

    WidgetUpdateModuleImpl.reloadWidgets()

    resolve("Cleared successfully")
  }

  // MARK: - Static Helpers

  @objc
  static func reloadWidgets() {
    // WidgetCenter.reloadAllTimelines()는 반드시 메인 스레드에서 호출해야 한다.
    // AppDelegate FCM 핸들러(백그라운드 스레드)에서 호출될 경우 silent no-op가 되므로
    // 항상 main queue로 dispatch 한다.
    DispatchQueue.main.async {
      WidgetCenter.shared.reloadAllTimelines()
    }
  }
}
