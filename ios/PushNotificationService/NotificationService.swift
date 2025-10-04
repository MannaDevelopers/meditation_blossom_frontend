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
            print("Received notification userInfo: \(userInfo)")

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
                    userDefaults.set(jsonString, forKey: "displaySermon")
                    print("Successfully stored sermon for widget")
                    WidgetCenter.shared.reloadTimelines(ofKind: "MeditationBlossomWidget")
                    print("Widget timeline reloaded.")
                }
            }
            
            contentHandler(bestAttemptContent)
        }
    }
  
    override func serviceExtensionTimeWillExpire() {
        // 이 메서드는 약 30초의 처리 시간이 다 되어갈 때 호출됩니다.
        // 시간이 만료되기 전에 반드시 contentHandler를 호출해야 합니다.
        if let contentHandler = contentHandler, let bestAttemptContent = bestAttemptContent {
            contentHandler(bestAttemptContent)
        }
    }
}
