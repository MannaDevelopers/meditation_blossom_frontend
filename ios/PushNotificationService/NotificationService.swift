import UserNotifications
import WidgetKit
import SQLite3 // BibleDbHelper가 사용하는 모듈 (BibleDbHelper.swift가 이 타겟에도 컴파일됨)

class NotificationService: UNNotificationServiceExtension {

    private enum Constants {
        static let appGroupId = "group.mannachurch.meditationblossom"
        static let displaySermonKey = "displaySermon"
        static let fcmSermonKey = "fcm_sermon"
        static let fcmQtKey = "fcm_qt"
        static let widgetKind = "MeditationBlossomWidget"
    }

    var contentHandler: ((UNNotificationContent) -> Void)?
    var bestAttemptContent: UNMutableNotificationContent?

    override func didReceive(_ request: UNNotificationRequest, withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
        self.contentHandler = contentHandler
        bestAttemptContent = (request.content.mutableCopy() as? UNMutableNotificationContent)

        guard let bestAttemptContent = bestAttemptContent else { return }

        let userInfo = request.content.userInfo
        NSLog("NotificationService: Received notification, keys: %@", Array(userInfo.keys).description)

        // WidgetKit Push 감지
        let widgetkit = findWidgetkitPayload(userInfo: userInfo)

        if let widgetkit = widgetkit {
            NSLog("NotificationService: WidgetKit Push detected")
            handleWidgetKitPush(userInfo: userInfo, widgetkit: widgetkit)

            // WidgetKit Push는 알림 표시하지 않음
            suppressNotification(bestAttemptContent)
            contentHandler(bestAttemptContent)
            return
        }

        // Data-only 메시지 확인 (content-available: 1, alert 없음)
        let isSilent = (userInfo["silent"] as? String) == "true" || (userInfo["widget_update_only"] as? String) == "true"

        if let aps = userInfo["aps"] as? [String: Any],
           let contentAvailable = aps["content-available"] as? Int,
           contentAvailable == 1 {

            // sermon_event 메시지 (alert + content-available) vs data-only
            let hasAlert = aps["alert"] != nil

            if let sermon = parseSermonFromUserInfo(userInfo) {
                saveSermonToAppGroup(sermon, userInfo: userInfo)

                if isSilent || !hasAlert {
                    suppressNotification(bestAttemptContent)
                }
            }

            contentHandler(bestAttemptContent)
            return
        }

        // 일반 FCM 메시지 처리
        if let sermon = parseSermonFromUserInfo(userInfo) {
            saveSermonToAppGroup(sermon, userInfo: userInfo)
        }

        contentHandler(bestAttemptContent)
    }

    // MARK: - WidgetKit Push

    private func findWidgetkitPayload(userInfo: [AnyHashable: Any]) -> [String: Any]? {
        // 1. 최상위 레벨
        if let wk = userInfo["widgetkit"] as? [String: Any] { return wk }
        // 2. aps 안
        if let aps = userInfo["aps"] as? [String: Any],
           let wk = aps["widgetkit"] as? [String: Any] { return wk }
        // 3. data 안
        if let data = userInfo["data"] as? [String: Any],
           let wk = data["widgetkit"] as? [String: Any] { return wk }
        // 4. payload 안
        if let payload = userInfo["payload"] as? [String: Any],
           let wk = payload["widgetkit"] as? [String: Any] { return wk }
        return nil
    }

    private func handleWidgetKitPush(userInfo: [AnyHashable: Any], widgetkit: [String: Any]) {
        // widgetkit.data를 우선 사용, 없으면 message.data를 fallback
        let widgetkitData = widgetkit["data"] as? [String: Any]
        let fallbackData = userInfo as? [String: Any] ?? [:]

        let id = (widgetkitData?["id"] as? String)
            ?? (widgetkitData?["source_id"] as? String)
            ?? (fallbackData["id"] as? String)
            ?? (fallbackData["source_id"] as? String)
            ?? generateSermonId(from: userInfo)

        guard let title = (widgetkitData?["title"] as? String) ?? (fallbackData["title"] as? String),
              let content = (widgetkitData?["content"] as? String) ?? (fallbackData["content"] as? String),
              let date = (widgetkitData?["date"] as? String) ?? (fallbackData["date"] as? String),
              let dayOfWeek = (widgetkitData?["day_of_week"] as? String) ?? (fallbackData["day_of_week"] as? String) else {
            NSLog("NotificationService: WidgetKit Push - required fields missing")
            return
        }

        let category = (fallbackData["category"] as? String) ?? (userInfo["category"] as? String)
        var createdAt: FirestoreTimeStamp? = nil
        var updatedAt: FirestoreTimeStamp? = nil
        if let createdStr = (fallbackData["created_at"] as? String) ?? (userInfo["created_at"] as? String) {
            createdAt = convertStringToTimestamp(createdStr)
        }
        if let updatedStr = (fallbackData["updated_at"] as? String) ?? (userInfo["updated_at"] as? String) {
            updatedAt = convertStringToTimestamp(updatedStr)
        }

        let sermon = Sermon(
            id: id, title: title, content: content, date: date,
            category: category, dayOfWeek: dayOfWeek,
            createdAt: createdAt, updatedAt: updatedAt
        )

        saveSermonToAppGroup(sermon, userInfo: userInfo)
    }

    // MARK: - Sermon Parsing & Saving

    // MARK: - Bible References

    /// bible_references JSON 배열(서버 snake_case 키)을 DB에서 조회하여 본문 문자열로 반환.
    /// 빈 배열([]) = 말씀 없는 날 → 빈 문자열 반환.
    private func resolveBibleReferencesFromUserInfo(_ userInfo: [AnyHashable: Any]) -> String? {
        guard let topic = userInfo["topic"] as? String else { return nil }
        let shouldResolve = topic.contains("v2") || topic.contains("qt_events")
        guard shouldResolve else { return nil }

        // bible_references는 JSON 문자열 또는 이미 파싱된 배열로 도착할 수 있음
        var refs: [[String: Any]] = []
        if let rawString = userInfo["bible_references"] as? String,
           let data = rawString.data(using: .utf8),
           let parsed = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] {
            refs = parsed
        } else if let rawArray = userInfo["bible_references"] as? [[String: Any]] {
            refs = rawArray
        }

        // refs가 여러 개인 경우 Android와 동일하게 "본문 : 참조1, 참조2 구절1 구절2" 포맷으로 합침
        var allRefStrings: [String] = []
        var allVerseLines: [String] = []

        for ref in refs {
            guard let book = ref["book"] as? String,
                  let chapter = ref["chapter"] as? Int,
                  let verseStart = ref["verse_start"] as? Int,
                  let verseEnd = ref["verse_end"] as? Int else { continue }

            let rangeStr = verseStart == verseEnd
                ? "\(chapter):\(verseStart)"
                : "\(chapter):\(verseStart)-\(verseEnd)"

            let text = BibleDbHelper.shared.getVerses(book: book, chapter: chapter,
                                                      verseStart: verseStart, verseEnd: verseEnd)
            if !text.isEmpty {
                allRefStrings.append("\(book) \(rangeStr)")
                allVerseLines.append(contentsOf: text.components(separatedBy: "\n").filter { !$0.isEmpty })
            }
        }

        guard !allRefStrings.isEmpty else { return "" }
        let reference = allRefStrings.joined(separator: ", ")
        let body = allVerseLines.joined(separator: " ")
        return "본문 : \(reference) \(body)"
    }

    private func parseSermonFromUserInfo(_ userInfo: [AnyHashable: Any]) -> Sermon? {
        let id = (userInfo["source_id"] as? String) ?? (userInfo["id"] as? String) ?? generateSermonId(from: userInfo)

        guard let title = userInfo["title"] as? String,
              let date = userInfo["date"] as? String,
              let dayOfWeek = userInfo["day_of_week"] as? String else {
            NSLog("NotificationService: parseSermonFromUserInfo failed - missing required fields (title/date/day_of_week)")
            return nil
        }

        // bible_references에서 본문 조회 시도; 없으면 content 필드 fallback
        let content: String
        if let resolved = resolveBibleReferencesFromUserInfo(userInfo) {
            content = resolved
        } else if let rawContent = userInfo["content"] as? String {
            content = rawContent
        } else {
            NSLog("NotificationService: parseSermonFromUserInfo - no content or bible_references")
            content = ""
        }

        let category = userInfo["category"] as? String
        var createdAt: FirestoreTimeStamp? = nil
        var updatedAt: FirestoreTimeStamp? = nil
        if let createdStr = userInfo["created_at"] as? String {
            createdAt = convertStringToTimestamp(createdStr)
        }
        if let updatedStr = userInfo["updated_at"] as? String {
            updatedAt = convertStringToTimestamp(updatedStr)
        }

        return Sermon(
            id: id, title: title, content: content, date: date,
            category: category, dayOfWeek: dayOfWeek,
            createdAt: createdAt, updatedAt: updatedAt
        )
    }

    private func saveSermonToAppGroup(_ sermon: Sermon, userInfo: [AnyHashable: Any]) {
        guard let userDefaults = UserDefaults(suiteName: Constants.appGroupId) else {
            NSLog("NotificationService: Failed to access App Group")
            return
        }

        do {
            let encodedData = try JSONEncoder().encode(sermon)
            guard var jsonString = String(data: encodedData, encoding: .utf8) else {
                NSLog("NotificationService: Failed to convert encoded data to string")
                return
            }

            let storageKey = asyncStorageKey(for: userInfo)

            // QT는 공용 Sermon 구조체가 표현하지 못하는 series_title / meditation_questions를
            // FCM userInfo에서 직접 보강한다. 누락 시 첫 설치 화면에서 카테고리·묵상질문이 비게 된다.
            if storageKey == Constants.fcmQtKey,
               let qtJson = qtJsonWithExtraFields(from: jsonString, userInfo: userInfo) {
                jsonString = qtJson
            }

            userDefaults.set(jsonString, forKey: storageKey)
            if storageKey == Constants.fcmSermonKey {
                userDefaults.set(jsonString, forKey: Constants.displaySermonKey)
            }
            userDefaults.synchronize()

            WidgetCenter.shared.reloadTimelines(ofKind: Constants.widgetKind)
            NSLog("NotificationService: Saved payload '%@' to %@ and reloaded widget", sermon.title, storageKey)
        } catch {
            NSLog("NotificationService: Failed to encode sermon: %@", error.localizedDescription)
        }
    }

    // 공용 Sermon 인코딩 JSON에 QT 전용 필드(series_title, meditation_questions)를 보강한다.
    // 두 필드는 Sermon 구조체에 없어 누락되며, JS(fcmDataToQt)와 위젯(QT)이 이를 요구한다.
    // meditation_questions는 JS 화면이 문자열(JSON 배열 문자열 또는 평문)로 파싱하므로
    // AppDelegate 경로와 동일하게 userInfo의 원본 문자열을 그대로 보존한다.
    private func qtJsonWithExtraFields(from jsonString: String, userInfo: [AnyHashable: Any]) -> String? {
        guard let data = jsonString.data(using: .utf8),
              var dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }
        dict["series_title"] = (userInfo["series_title"] as? String) ?? ""
        if let questions = userInfo["meditation_questions"] as? String {
            dict["meditation_questions"] = questions
        }
        guard let merged = try? JSONSerialization.data(withJSONObject: dict),
              let result = String(data: merged, encoding: .utf8) else {
            return nil
        }
        return result
    }

    // MARK: - Notification Suppression

    private func suppressNotification(_ content: UNMutableNotificationContent) {
        content.title = ""
        content.body = ""
        content.sound = nil
        content.badge = nil
        content.categoryIdentifier = ""
        content.threadIdentifier = ""
    }

    // MARK: - Helpers

    private func generateSermonId(from userInfo: [AnyHashable: Any]) -> String {
        if let messageId = userInfo["gcm.message_id"] as? String {
            return messageId
        }
        if let date = userInfo["date"] as? String,
           let title = userInfo["title"] as? String {
            return "\(date)_\(title.prefix(20))"
                .replacingOccurrences(of: " ", with: "_")
                .replacingOccurrences(of: "/", with: "-")
                .replacingOccurrences(of: ":", with: "-")
        }
        return "fcm_\(Int64(Date().timeIntervalSince1970 * 1000))"
    }

    private func asyncStorageKey(for userInfo: [AnyHashable: Any]) -> String {
        let topic = String(describing: userInfo["topic"] ?? "").lowercased()
        let from = String(describing: userInfo["from"] ?? "").lowercased()
        let category = String(describing: userInfo["category"] ?? "").lowercased()

        if topic.contains("qt") || from.contains("qt") || category == "qt" {
            return Constants.fcmQtKey
        }

        return Constants.fcmSermonKey
    }

    private func convertStringToTimestamp(_ isoString: String) -> FirestoreTimeStamp? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        if let date = formatter.date(from: isoString) {
            let seconds = Int64(date.timeIntervalSince1970)
            let nanoseconds = Int32((date.timeIntervalSince1970 - Double(seconds)) * 1_000_000_000)
            return FirestoreTimeStamp(seconds: seconds, nanoseconds: nanoseconds)
        }

        // 한국어 로케일 형식 시도 (예: "2025년 11월 11일 오전 5시 18분 46초 UTC+9")
        let koreanLocaleRegex = #"(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*(오전|오후)\s*(\d{1,2})시\s*(\d{1,2})분\s*(\d{1,2})초\s*UTC([+-]\d{1,2})"#

        if let regex = try? NSRegularExpression(pattern: koreanLocaleRegex),
           let match = regex.firstMatch(in: isoString, range: NSRange(isoString.startIndex..., in: isoString)) {

            let year = Int((isoString as NSString).substring(with: match.range(at: 1))) ?? 0
            let month = Int((isoString as NSString).substring(with: match.range(at: 2))) ?? 0
            let day = Int((isoString as NSString).substring(with: match.range(at: 3))) ?? 0
            let meridiem = (isoString as NSString).substring(with: match.range(at: 4))
            var hour = Int((isoString as NSString).substring(with: match.range(at: 5))) ?? 0
            let minute = Int((isoString as NSString).substring(with: match.range(at: 6))) ?? 0
            let second = Int((isoString as NSString).substring(with: match.range(at: 7))) ?? 0
            let offsetHours = Int((isoString as NSString).substring(with: match.range(at: 8))) ?? 0

            if meridiem == "오전" {
                if hour == 12 { hour = 0 }
            } else if meridiem == "오후" {
                if hour < 12 { hour += 12 }
            }

            var components = DateComponents()
            components.year = year
            components.month = month
            components.day = day
            components.hour = hour - offsetHours
            components.minute = minute
            components.second = second

            if let date = Calendar(identifier: .gregorian).date(from: components) {
                let seconds = Int64(date.timeIntervalSince1970)
                let nanoseconds = Int32((date.timeIntervalSince1970 - Double(seconds)) * 1_000_000_000)
                return FirestoreTimeStamp(seconds: seconds, nanoseconds: nanoseconds)
            }
        }

        return nil
    }

    override func serviceExtensionTimeWillExpire() {
        if let contentHandler = contentHandler, let bestAttemptContent = bestAttemptContent {
            contentHandler(bestAttemptContent)
        }
    }
}
