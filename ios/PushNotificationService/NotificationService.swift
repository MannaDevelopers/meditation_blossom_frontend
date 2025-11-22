import UserNotifications
import WidgetKit

class NotificationService: UNNotificationServiceExtension {

    var contentHandler: ((UNNotificationContent) -> Void)?
    var bestAttemptContent: UNMutableNotificationContent?

    override func didReceive(_ request: UNNotificationRequest, withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
        self.contentHandler = contentHandler
        bestAttemptContent = (request.content.mutableCopy() as? UNMutableNotificationContent)

        if let bestAttemptContent = bestAttemptContent {
            let userInfo = request.content.userInfo
            print("📬 NotificationService: Received notification userInfo: \(userInfo)")
            print("📬 NotificationService: All keys in userInfo: \(userInfo.keys)")

            // WidgetKit Push Notifications 확인
            // Firebase를 통해 전송될 때 widgetkit 키가 최상위 레벨에 올 수 있음
            // 또는 apns.payload 안에 있을 수 있음
            var widgetkit: [String: Any]? = nil
            
            // 1. 최상위 레벨에서 widgetkit 확인
            if let topLevelWidgetkit = userInfo["widgetkit"] as? [String: Any] {
                widgetkit = topLevelWidgetkit
                print("📬 Found widgetkit at top level")
            }
            // 2. aps 안에서 widgetkit 확인 (Firebase가 구조를 변경할 수 있음)
            else if let aps = userInfo["aps"] as? [String: Any],
                    let apsWidgetkit = aps["widgetkit"] as? [String: Any] {
                widgetkit = apsWidgetkit
                print("📬 Found widgetkit inside aps")
            }
            // 3. data 필드에서 widgetkit 확인 (Firebase가 data 필드에 넣을 수도 있음)
            else if let data = userInfo["data"] as? [String: Any],
                    let dataWidgetkit = data["widgetkit"] as? [String: Any] {
                widgetkit = dataWidgetkit
                print("📬 Found widgetkit inside data")
            }
            
            if let widgetkit = widgetkit,
               let kind = widgetkit["kind"] as? String,
               kind == "MeditationBlossomWidget" {
                print("🎯 WidgetKit Push Notification detected for \(kind)")
                handleWidgetKitPush(userInfo: userInfo, widgetkit: widgetkit)
                // WidgetKit Push는 silent이므로 알림 표시하지 않음
                bestAttemptContent.sound = nil
                bestAttemptContent.badge = nil
                contentHandler(bestAttemptContent)
                return
            } else {
                print("ℹ️ No widgetkit found, checking if this is a data-only message for widget update")
                
                // WidgetKit Push가 아니어도 data-only 메시지이면 위젯 업데이트 시도
                // content-available: 1이 있으면 data-only 메시지
                if let aps = userInfo["aps"] as? [String: Any],
                   let contentAvailable = aps["content-available"] as? Int,
                   contentAvailable == 1 {
                    print("📦 Data-only message detected (content-available: 1), processing for widget update")
                    // data-only 메시지 처리 (위젯 업데이트용)
                    if let id = userInfo["id"] as? String,
                       let title = userInfo["title"] as? String,
                       let content = userInfo["content"] as? String,
                       let date = userInfo["date"] as? String,
                       let dayOfWeek = userInfo["day_of_week"] as? String {
                        let category = userInfo["category"] as? String
                        let sermon = Sermon(
                            id: id,
                            title: title,
                            content: content,
                            date: date,
                            category: category,
                            dayOfWeek: dayOfWeek,
                            createdAt: nil,
                            updatedAt: nil
                        )
                        
                        print("✅ Data-only: Parsed sermon - \(sermon.title)")
                        
                        if let userDefaults = UserDefaults(suiteName: "group.mannachurch.meditationblossom") {
                            let encoder = JSONEncoder()
                            if let encodedData = try? encoder.encode(sermon),
                               let jsonString = String(data: encodedData, encoding: .utf8) {
                                userDefaults.set(jsonString, forKey: "displaySermon")
                                userDefaults.set(jsonString, forKey: "fcm_sermon")
                                userDefaults.synchronize()
                                print("✅ Data-only: Stored sermon in App Group")
                                WidgetCenter.shared.reloadTimelines(ofKind: "MeditationBlossomWidget")
                                print("✅ Data-only: Widget timeline reloaded")
                            }
                        }
                        
                        // Data-only 메시지는 알림 표시하지 않음
                        bestAttemptContent.sound = nil
                        bestAttemptContent.badge = nil
                        contentHandler(bestAttemptContent)
                        return
                    }
                }
                
                print("ℹ️ No widgetkit found and not a data-only message, treating as regular FCM message")
            }
            
            // 일반 FCM 메시지 처리 (WidgetKit Push가 아니고 data-only도 아닌 경우)
            // 수동으로 userInfo에서 데이터를 파싱합니다.
            // FCM 메시지의 'data' 페이로드에 포함된 키들입니다.
            guard let id = userInfo["id"] as? String,
                  let title = userInfo["title"] as? String,
                  let content = userInfo["content"] as? String,
                  let date = userInfo["date"] as? String,
                  let dayOfWeek = userInfo["day_of_week"] as? String else {
                
                print("Sermon data parsing failed: required fields are missing.")
                contentHandler(bestAttemptContent)
                return
            }
            
            let category = userInfo["category"] as? String // Optional

            // test_fcm.js 페이로드에는 createdAt/updatedAt이 없으므로 nil로 처리합니다.
            // Sermon 구조체의 해당 프로퍼티가 Optional이므로 문제 없습니다.
            let sermon = Sermon(
                id: id,
                title: title,
                content: content,
                date: date,
                category: category,
                dayOfWeek: dayOfWeek,
                createdAt: nil,
                updatedAt: nil
            )

            print("SUCCESS: Manually parsed Sermon object: \(sermon.title)")

            if let userDefaults = UserDefaults(suiteName: "group.mannachurch.meditationblossom") {
                let encoder = JSONEncoder()
                if let encodedData = try? encoder.encode(sermon),
                   let jsonString = String(data: encodedData, encoding: .utf8) {
                    // displaySermon과 fcm_sermon 둘 다 저장 (호환성)
                    userDefaults.set(jsonString, forKey: "displaySermon")
                    userDefaults.set(jsonString, forKey: "fcm_sermon")
                    userDefaults.synchronize() // 즉시 동기화 보장
                    print("Successfully stored sermon for widget (displaySermon and fcm_sermon)")
                    WidgetCenter.shared.reloadTimelines(ofKind: "MeditationBlossomWidget")
                    print("Widget timeline reloaded.")
                }
            }
            
            contentHandler(bestAttemptContent)
        }
    }
    
    // WidgetKit Push Notifications 처리
    private func handleWidgetKitPush(userInfo: [AnyHashable: Any], widgetkit: [String: Any]) {
        // WidgetKit Push는 위젯만 업데이트하고 알림은 표시하지 않음
        print("📦 WidgetKit Push: Processing widgetkit data")
        print("📦 WidgetKit Push: widgetkit = \(widgetkit)")
        
        // widgetkit.data를 우선 사용, 없으면 message.data를 fallback으로 사용
        var data: [String: Any]? = widgetkit["data"] as? [String: Any]
        
        if data == nil {
            print("⚠️ WidgetKit Push: widgetkit.data not found, using message.data as fallback")
            // message.data를 사용 (Firebase가 widgetkit을 전달하지 못한 경우)
            data = userInfo as? [String: Any]
        }
        
        guard let data = data else {
            print("⚠️ WidgetKit Push: No data found in widgetkit or userInfo")
            return
        }
        
        print("📦 WidgetKit Push: Using data = \(data)")
        
        // 데이터 파싱 (widgetkit.data 우선, 없으면 message.data 사용)
        guard let id = (widgetkit["data"] as? [String: Any])?["id"] as? String ?? (data["id"] as? String),
              let title = (widgetkit["data"] as? [String: Any])?["title"] as? String ?? (data["title"] as? String),
              let content = (widgetkit["data"] as? [String: Any])?["content"] as? String ?? (data["content"] as? String),
              let date = (widgetkit["data"] as? [String: Any])?["date"] as? String ?? (data["date"] as? String),
              let dayOfWeek = (widgetkit["data"] as? [String: Any])?["day_of_week"] as? String ?? (data["day_of_week"] as? String) else {
            print("⚠️ WidgetKit Push: Required fields missing")
            return
        }
        
        let category = (data["category"] as? String) ?? (userInfo["category"] as? String)
        
        // createdAt/updatedAt 처리
        var createdAt: FirestoreTimeStamp? = nil
        var updatedAt: FirestoreTimeStamp? = nil
        
        if let createdStr = (data["created_at"] as? String) ?? (userInfo["created_at"] as? String) {
            createdAt = convertStringToTimestamp(createdStr)
        }
        if let updatedStr = (data["updated_at"] as? String) ?? (userInfo["updated_at"] as? String) {
            updatedAt = convertStringToTimestamp(updatedStr)
        }
        
        let sermon = Sermon(
            id: id,
            title: title,
            content: content,
            date: date,
            category: category,
            dayOfWeek: dayOfWeek,
            createdAt: createdAt,
            updatedAt: updatedAt
        )
        
        print("✅ WidgetKit Push: Parsed sermon - \(sermon.title)")
        
        // App Group에 저장 (fcm_sermon과 displaySermon 둘 다 저장)
        if let userDefaults = UserDefaults(suiteName: "group.mannachurch.meditationblossom") {
            let encoder = JSONEncoder()
            if let encodedData = try? encoder.encode(sermon),
               let jsonString = String(data: encodedData, encoding: .utf8) {
                // displaySermon과 fcm_sermon 둘 다 저장 (호환성)
                userDefaults.set(jsonString, forKey: "displaySermon")
                userDefaults.set(jsonString, forKey: "fcm_sermon")
                userDefaults.synchronize() // 즉시 동기화 보장
                print("✅ WidgetKit Push: Stored sermon in App Group (displaySermon and fcm_sermon)")
                
                // 위젯 타임라인 업데이트
                WidgetCenter.shared.reloadTimelines(ofKind: "MeditationBlossomWidget")
                print("✅ WidgetKit Push: Widget timeline reloaded")
            }
        }
    }
    
    // 문자열을 Firestore 타임스탬프로 변환
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
                if hour == 12 {
                    hour = 0
                }
            } else if meridiem == "오후" {
                if hour < 12 {
                    hour += 12
                }
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
        // 이 메서드는 약 30초의 처리 시간이 다 되어갈 때 호출됩니다.
        // 시간이 만료되기 전에 반드시 contentHandler를 호출해야 합니다.
        if let contentHandler = contentHandler, let bestAttemptContent = bestAttemptContent {
            contentHandler(bestAttemptContent)
        }
    }
}
