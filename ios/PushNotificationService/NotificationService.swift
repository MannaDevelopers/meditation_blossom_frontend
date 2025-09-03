import UserNotifications
import WidgetKit

class NotificationService: UNNotificationServiceExtension {

    var contentHandler: ((UNNotificationContent) -> Void)?
    var bestAttemptContent: UNMutableNotificationContent?

    override func didReceive(_ request: UNNotificationRequest, withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
        print("fcm 발생")
        self.contentHandler = contentHandler
        bestAttemptContent = (request.content.mutableCopy() as? UNMutableNotificationContent)

        if let bestAttemptContent = bestAttemptContent {
            let userInfo = request.content.userInfo
            
            // 1. userInfo([AnyHashable: Any])를 Data 타입으로 변환
            guard let data = try? JSONSerialization.data(withJSONObject: userInfo, options: []) else {
                contentHandler(bestAttemptContent)
                print("타입변환 실패")
                return
            }

            // 2. Data를 Sermon 객체로 디코딩
            do {
                let sermon = try JSONDecoder().decode(Sermon.self, from: data)
                print("FCM 데이터를 Sermon 객체로 파싱 성공: \(sermon.title)")

                if let userDefaults = UserDefaults(suiteName: "group.com.MannaDev.MeditationBlossom") {
                    // 3. 파싱된 Sermon 객체를 다시 Data 형태로 인코딩하여 저장
                    let encoder = JSONEncoder()
                    if let encodedSermon = try? encoder.encode(sermon) {
                        userDefaults.set(encodedSermon, forKey: "displaySermon")
                        print("인코딩된 Sermon 데이터를 App Group에 저장했습니다.")
                        
                        WidgetCenter.shared.reloadAllTimelines()
                    }
                }
            } catch {
                print("Sermon 객체 디코딩 실패: \(error.localizedDescription)")
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
