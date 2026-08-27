import Foundation
import WidgetKit
import ImageIO
import UniformTypeIdentifiers

typealias RCTPromiseResolveBlock = @convention(block) (Any?) -> Void
typealias RCTPromiseRejectBlock = @convention(block) (String, String, Error?) -> Void

// src/types/WidgetDesign.ts와 1:1 대응하는 브릿지 전송 타입.
// App Group 접근(FileManager containerURL)에 의존하지 않는 순수 함수로 분리해
// 테스트 타깃(App Group 엔타이틀먼트 없음)에서도 검증 가능하게 한다.
enum WidgetDesignPersistence {
  enum PersistenceError: Error, Equatable {
    case invalidDesignJSON
    case imageDecodeFailed
    case imageWriteFailed
  }

  struct ImageTransform: Codable {
    let zoom: Double
    let focalX: Double
    let focalY: Double
  }

  struct TextDesign: Codable {
    let align: String
    let color: String
    let size: Int
    let weight: String
  }

  struct BackgroundDesign: Codable {
    let type: String
    var value: String
    let imageTransform: ImageTransform?
  }

  struct Design: Codable {
    let text: TextDesign
    var background: BackgroundDesign
  }

  static let maxBackgroundDimension: CGFloat = 1024
  static let backgroundJPEGQuality: CGFloat = 0.85

  // designData(JS WidgetDesign JSON)를 파싱해 background.type이 "gallery"면 이미지를
  // containerURL/backgroundFileName 경로로 다운샘플링·압축 저장하고, 그 영구 경로로
  // background.value를 치환한 JSON을 반환한다. "color"면 파싱↔재인코딩만 하고 그대로 반환.
  static func persist(designData: String, containerURL: URL, backgroundFileName: String) throws -> String {
    guard let data = designData.data(using: .utf8) else { throw PersistenceError.invalidDesignJSON }
    var design: Design
    do {
      design = try JSONDecoder().decode(Design.self, from: data)
    } catch {
      throw PersistenceError.invalidDesignJSON
    }

    if design.background.type == "gallery" {
      let destinationURL = containerURL.appendingPathComponent(backgroundFileName)
      try downsampleAndStore(sourcePath: design.background.value, to: destinationURL)
      design.background.value = destinationURL.path
    }

    guard let encoded = try? JSONEncoder().encode(design),
          let jsonString = String(data: encoded, encoding: .utf8) else {
      throw PersistenceError.invalidDesignJSON
    }
    return jsonString
  }

  // ImageIO의 썸네일 생성 옵션이 2-pass 다운샘플링을 API 레벨에서 제공하므로(Android처럼
  // inSampleSize를 직접 계산할 필요 없음), 원본을 통째로 메모리에 올리지 않고 바로 축소본을 얻는다.
  private static func downsampleAndStore(sourcePath: String, to destinationURL: URL) throws {
    let sourceURL = resolveFileURL(sourcePath)
    let thumbnailOptions: [CFString: Any] = [
      kCGImageSourceCreateThumbnailFromImageAlways: true,
      kCGImageSourceThumbnailMaxPixelSize: maxBackgroundDimension,
      kCGImageSourceCreateThumbnailWithTransform: true, // EXIF 회전 반영
    ]
    guard let imageSource = CGImageSourceCreateWithURL(sourceURL as CFURL, nil),
          let thumbnail = CGImageSourceCreateThumbnailAtIndex(imageSource, 0, thumbnailOptions as CFDictionary) else {
      throw PersistenceError.imageDecodeFailed
    }

    guard let destination = CGImageDestinationCreateWithURL(destinationURL as CFURL, UTType.jpeg.identifier as CFString, 1, nil) else {
      throw PersistenceError.imageWriteFailed
    }
    let writeOptions: [CFString: Any] = [kCGImageDestinationLossyCompressionQuality: backgroundJPEGQuality]
    CGImageDestinationAddImage(destination, thumbnail, writeOptions as CFDictionary)
    guard CGImageDestinationFinalize(destination) else {
      throw PersistenceError.imageWriteFailed
    }
  }

  // react-native-image-picker(iOS)는 선택한 사진을 앱 임시 디렉터리로 복사해 file:// URI로
  // 돌려준다. 이미 한 번 영속화된 값(재편집 시 로드된 기존 디자인)은 스킴 없는 절대 경로이므로,
  // 스킴이 있으면 URL(string:)으로, 없으면 URL(fileURLWithPath:)로 해석한다.
  private static func resolveFileURL(_ path: String) -> URL {
    if let url = URL(string: path), url.scheme != nil {
      return url
    }
    return URL(fileURLWithPath: path)
  }
}

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
    static let widgetDesignKey = "widget_design"
    static let widgetDesignQtKey = "widget_design_qt"
    static let widgetDesignBackgroundFilePrefixSermon = "widget_design_background_sermon_"
    static let widgetDesignBackgroundFilePrefixQt = "widget_design_background_qt_"
  }

  // 배경 사진을 매번 고유 파일명으로 저장한다 — 고정 파일명에 덮어쓰면(과거 방식) 메인 앱
  // 프로세스의 쓰기와 위젯 익스텐션 프로세스의 다음 읽기 사이에 실기기에서 타이밍/캐시 지연이
  // 생겨 사진이 바로 갱신되지 않는 문제가 있었다(색상은 JSON 안 hex 값이라 즉시 반영되지만,
  // 사진은 파일을 다시 읽어야 해서 영향을 받음 — 시뮬레이터에서는 디스크가 빨라 재현 안 됨).
  private static func uniqueBackgroundFileName(prefix: String) -> String {
    "\(prefix)\(UUID().uuidString).jpg"
  }

  // 저장 직전 시점의 기존 디자인에서 갤러리 배경 파일 경로를 추출 — 새 파일 저장 성공 후
  // 이전 파일을 정리해 App Group 컨테이너에 파일이 계속 쌓이지 않게 한다.
  private static func galleryBackgroundPath(fromDesignJSON designJSON: String?) -> String? {
    guard let designJSON, let data = designJSON.data(using: .utf8),
          let design = try? JSONDecoder().decode(WidgetDesignPersistence.Design.self, from: data),
          design.background.type == "gallery" else {
      return nil
    }
    return design.background.value
  }

  private static func removeFileIfExists(atPath path: String) {
    guard FileManager.default.fileExists(atPath: path) else { return }
    try? FileManager.default.removeItem(atPath: path)
  }

  private static func appGroupDefaults() -> UserDefaults? {
    UserDefaults(suiteName: Constants.appGroupId)
  }

  private static func appGroupContainerURL() -> URL? {
    FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: Constants.appGroupId)
  }

  // 다운샘플링+JPEG 압축은 가벼운 작업이 아니므로, resolveBibleReferences의 dbQueue와
  // 동일하게 전용 직렬 큐에서 처리해 호출 스레드(JS 스레드일 수 있음)를 막지 않는다.
  private static let designQueue = DispatchQueue(label: "com.mannachurch.WidgetDesignPersistence", qos: .userInitiated)

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

  // MARK: - Widget Design

  @objc
  func onWidgetDesignUpdated(_ designData: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let sharedDefaults = Self.appGroupDefaults(), let containerURL = Self.appGroupContainerURL() else {
      reject("APP_GROUP_ERROR", "App Group을 찾을 수 없습니다.", nil)
      return
    }
    let previousBackgroundPath = WidgetUpdateModuleImpl.galleryBackgroundPath(fromDesignJSON: sharedDefaults.string(forKey: Constants.widgetDesignKey))
    WidgetUpdateModuleImpl.designQueue.async {
      do {
        let backgroundFileName = WidgetUpdateModuleImpl.uniqueBackgroundFileName(prefix: Constants.widgetDesignBackgroundFilePrefixSermon)
        let persisted = try WidgetDesignPersistence.persist(
          designData: designData,
          containerURL: containerURL,
          backgroundFileName: backgroundFileName
        )
        sharedDefaults.set(persisted, forKey: Constants.widgetDesignKey)
        sharedDefaults.synchronize()
        if let previousBackgroundPath, previousBackgroundPath != containerURL.appendingPathComponent(backgroundFileName).path {
          WidgetUpdateModuleImpl.removeFileIfExists(atPath: previousBackgroundPath)
        }
        WidgetUpdateModuleImpl.reloadWidgets()
        resolve(persisted)
      } catch {
        NSLog("onWidgetDesignUpdated error: %@", String(describing: error))
        reject("WIDGET_DESIGN_UPDATE_ERROR", String(describing: error), error)
      }
    }
  }

  @objc
  func onQtWidgetDesignUpdated(_ designData: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let sharedDefaults = Self.appGroupDefaults(), let containerURL = Self.appGroupContainerURL() else {
      reject("APP_GROUP_ERROR", "App Group을 찾을 수 없습니다.", nil)
      return
    }
    let previousBackgroundPath = WidgetUpdateModuleImpl.galleryBackgroundPath(fromDesignJSON: sharedDefaults.string(forKey: Constants.widgetDesignQtKey))
    WidgetUpdateModuleImpl.designQueue.async {
      do {
        let backgroundFileName = WidgetUpdateModuleImpl.uniqueBackgroundFileName(prefix: Constants.widgetDesignBackgroundFilePrefixQt)
        let persisted = try WidgetDesignPersistence.persist(
          designData: designData,
          containerURL: containerURL,
          backgroundFileName: backgroundFileName
        )
        sharedDefaults.set(persisted, forKey: Constants.widgetDesignQtKey)
        sharedDefaults.synchronize()
        if let previousBackgroundPath, previousBackgroundPath != containerURL.appendingPathComponent(backgroundFileName).path {
          WidgetUpdateModuleImpl.removeFileIfExists(atPath: previousBackgroundPath)
        }
        WidgetUpdateModuleImpl.reloadWidgets()
        resolve(persisted)
      } catch {
        NSLog("onQtWidgetDesignUpdated error: %@", String(describing: error))
        reject("QT_WIDGET_DESIGN_UPDATE_ERROR", String(describing: error), error)
      }
    }
  }

  // MARK: - Picked Image Persistence

  // 사진 피커(react-native-image-picker)가 만드는 파일은 NSTemporaryDirectory()에 있어 iOS가
  // 예고 없이 정리할 수 있다([#252]) — Caches 디렉토리로 즉시 복사해 "최근 이미지" 목록/이후
  // 저장 시점까지 안전하게 참조할 수 있는 경로를 돌려준다.
  @objc
  func persistPickedImage(_ sourceUri: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    WidgetUpdateModuleImpl.designQueue.async {
      do {
        guard let sourceURL = URL(string: sourceUri) else {
          throw NSError(domain: "PersistPickedImage", code: 1, userInfo: [NSLocalizedDescriptionKey: "Invalid source URI: \(sourceUri)"])
        }
        let data = try Data(contentsOf: sourceURL)
        let cachesURL = try FileManager.default.url(for: .cachesDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
        let ext = sourceURL.pathExtension.isEmpty ? "jpg" : sourceURL.pathExtension
        let destinationURL = cachesURL.appendingPathComponent("picked_image_\(UUID().uuidString).\(ext)")
        try data.write(to: destinationURL)
        resolve(destinationURL.absoluteString)
      } catch {
        NSLog("persistPickedImage error: %@", String(describing: error))
        reject("PERSIST_PICKED_IMAGE_ERROR", String(describing: error), error)
      }
    }
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
