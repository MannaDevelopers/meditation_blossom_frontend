import UserNotifications
import WidgetKit

class NotificationService: UNNotificationServiceExtension {

    var contentHandler: ((UNNotificationContent) -> Void)?
    var bestAttemptContent: UNMutableNotificationContent?

    override func didReceive(_ request: UNNotificationRequest, withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
        // NSLog는 Console.app에서 더 잘 보임
        NSLog("🚀 NotificationService: Extension started - didReceive called")
        NSLog("📬 NotificationService: Processing notification request...")
        NSLog("📬 NotificationService: Notification identifier: %@", request.identifier)
        // print도 유지 (Xcode 콘솔용)
        print("🚀 NotificationService: Extension started - didReceive called")
        print("📬 NotificationService: Processing notification request...")
        print("📬 NotificationService: Notification identifier: \(request.identifier)")
        
        self.contentHandler = contentHandler
        bestAttemptContent = (request.content.mutableCopy() as? UNMutableNotificationContent)

        if let bestAttemptContent = bestAttemptContent {
            let userInfo = request.content.userInfo
            NSLog("📬 NotificationService: Received notification userInfo")
            NSLog("📬 NotificationService: All keys count: %lu", userInfo.keys.count)
            // print도 유지 (Xcode 콘솔용)
            print("📬 NotificationService: Received notification userInfo: \(userInfo)")
            print("📬 NotificationService: All keys in userInfo: \(userInfo.keys)")
            
            // 디버깅: userInfo 구조 전체 출력
            if let jsonData = try? JSONSerialization.data(withJSONObject: userInfo, options: .prettyPrinted),
               let jsonString = String(data: jsonData, encoding: .utf8) {
                print("📬 NotificationService: Full userInfo JSON structure:")
                print(jsonString)
            }

            // WidgetKit Push Notifications 확인
            // Firebase를 통해 전송될 때 widgetkit 키가 최상위 레벨에 올 수 있음
            // 또는 apns.payload 안에 있을 수 있음
            var widgetkit: [String: Any]? = nil
            
            // 1. 최상위 레벨에서 widgetkit 확인
            if let topLevelWidgetkit = userInfo["widgetkit"] as? [String: Any] {
                widgetkit = topLevelWidgetkit
                NSLog("✅ WidgetKit Push: Found widgetkit at top level of userInfo")
                NSLog("✅ WidgetKit Push: widgetkit keys: %@", Array(topLevelWidgetkit.keys).description)
                print("✅ WidgetKit Push: Found widgetkit at top level of userInfo")
                print("✅ WidgetKit Push: widgetkit keys: \(Array(topLevelWidgetkit.keys))")
                
                // reloadTimelines 확인
                if let reloadTimelines = topLevelWidgetkit["reloadTimelines"] {
                    NSLog("✅ WidgetKit Push: reloadTimelines found in widgetkit: %@", String(describing: reloadTimelines))
                    print("✅ WidgetKit Push: reloadTimelines found in widgetkit: \(reloadTimelines)")
                } else {
                    NSLog("❌ WidgetKit Push: reloadTimelines NOT found in widgetkit")
                    print("❌ WidgetKit Push: reloadTimelines NOT found in widgetkit")
                }
            }
            // 2. aps 안에서 widgetkit 확인 (Firebase가 구조를 변경할 수 있음)
            else if let aps = userInfo["aps"] as? [String: Any] {
                print("📬 Checking for widgetkit inside aps...")
                if let apsWidgetkit = aps["widgetkit"] as? [String: Any] {
                    widgetkit = apsWidgetkit
                    print("✅ WidgetKit Push: Found widgetkit inside aps")
                } else {
                    print("❌ WidgetKit Push: No widgetkit found inside aps")
                }
            }
            // 3. data 필드에서 widgetkit 확인 (Firebase가 data 필드에 넣을 수도 있음)
            else if let data = userInfo["data"] as? [String: Any] {
                print("📬 Checking for widgetkit inside data...")
                if let dataWidgetkit = data["widgetkit"] as? [String: Any] {
                    widgetkit = dataWidgetkit
                    print("✅ WidgetKit Push: Found widgetkit inside data")
                } else {
                    print("❌ WidgetKit Push: No widgetkit found inside data")
                }
            }
            
            // 4. payload 안에서 widgetkit 확인 (Firebase가 payload 안에 넣을 수도 있음)
            if widgetkit == nil {
                if let payload = userInfo["payload"] as? [String: Any] {
                    print("📬 Checking for widgetkit inside payload...")
                    if let payloadWidgetkit = payload["widgetkit"] as? [String: Any] {
                        widgetkit = payloadWidgetkit
                        print("✅ WidgetKit Push: Found widgetkit inside payload")
                    }
                }
            }
            
            // WidgetKit Push 확인: reloadTimelines 또는 kind 확인
            var isWidgetKitPush = false
            var widgetKind: String? = nil
            
            // 1. reloadTimelines가 있는지 확인 (WidgetKit Push의 표준 방식)
            if let reloadTimelines = widgetkit?["reloadTimelines"] as? [String] {
                isWidgetKitPush = true
                widgetKind = reloadTimelines.first
                NSLog("🎯 WidgetKit Push: reloadTimelines found: %@", reloadTimelines.description)
                print("🎯 WidgetKit Push: reloadTimelines found: \(reloadTimelines)")
            }
            // 2. kind가 있는지 확인 (레거시 방식)
            else if let kind = widgetkit?["kind"] as? String, kind == "MeditationBlossomWidget" {
                isWidgetKitPush = true
                widgetKind = kind
                NSLog("🎯 WidgetKit Push: kind found: %@", kind)
                print("🎯 WidgetKit Push: kind found: \(kind)")
            }
            // 3. widgetkit 키가 있으면 WidgetKit Push로 간주 (Firebase가 reloadTimelines를 제거했을 수 있음)
            else if widgetkit != nil {
                isWidgetKitPush = true
                widgetKind = "MeditationBlossomWidget" // 기본값 사용
                NSLog("🎯 WidgetKit Push: widgetkit found but reloadTimelines/kind not found - treating as WidgetKit Push")
                NSLog("⚠️ WidgetKit Push: Firebase may have removed reloadTimelines - will manually trigger widget update")
                print("🎯 WidgetKit Push: widgetkit found but reloadTimelines/kind not found - treating as WidgetKit Push")
                print("⚠️ WidgetKit Push: Firebase may have removed reloadTimelines - will manually trigger widget update")
            }
            
            if isWidgetKitPush, let kind = widgetKind, let widgetkitUnwrapped = widgetkit {
                NSLog("🎯 WidgetKit Push Notification detected for %@", kind)
                NSLog("🎯 WidgetKit Push: widgetkit structure found")
                // silent 플래그 확인
                let isSilent = (userInfo["silent"] as? String) == "true" || (userInfo["widget_update_only"] as? String) == "true"
                NSLog("🔇 WidgetKit Push: Silent flag = %@", isSilent ? "YES" : "NO")
                // print도 유지 (Xcode 콘솔용)
                print("🎯 WidgetKit Push Notification detected for \(kind)")
                print("🎯 WidgetKit Push: widgetkit structure:")
                if let widgetkitJson = try? JSONSerialization.data(withJSONObject: widgetkitUnwrapped, options: .prettyPrinted),
                   let widgetkitString = String(data: widgetkitJson, encoding: .utf8) {
                    print(widgetkitString)
                }
                print("🔇 WidgetKit Push: Silent flag = \(isSilent ? "YES" : "NO")")
                
                handleWidgetKitPush(userInfo: userInfo, widgetkit: widgetkitUnwrapped)
                print("✅ WidgetKit Push: handleWidgetKitPush completed")
                
                // WidgetKit Push는 위젯만 업데이트하므로 알림 표시하지 않음
                // silent 플래그가 있으면 알림을 완전히 숨김
                if isSilent {
                    print("🔇 WidgetKit Push: Suppressing notification display (silent mode)")
                    bestAttemptContent.title = ""
                    bestAttemptContent.body = ""
                    bestAttemptContent.sound = nil
                    bestAttemptContent.badge = nil
                    bestAttemptContent.categoryIdentifier = ""
                    bestAttemptContent.threadIdentifier = ""
                } else {
                    // silent 플래그가 없어도 WidgetKit Push는 알림을 최소화
                    bestAttemptContent.title = ""
                    bestAttemptContent.body = ""
                    bestAttemptContent.sound = nil
                    bestAttemptContent.badge = nil
                    bestAttemptContent.categoryIdentifier = ""
                }
                print("📤 WidgetKit Push: Calling contentHandler to complete notification processing...")
                contentHandler(bestAttemptContent)
                print("✅ WidgetKit Push: contentHandler called successfully")
                return
            } else {
                print("❌ WidgetKit Push: No valid widgetkit found in notification")
                print("ℹ️ Checking if this is a data-only message for widget update...")
                
                // WidgetKit Push가 아니어도 data-only 메시지이면 위젯 업데이트 시도
                // silent 플래그가 있으면 위젯 업데이트만 수행하고 알림 표시하지 않음
                let isSilent = (userInfo["silent"] as? String) == "true" || (userInfo["widget_update_only"] as? String) == "true"
                
                if let aps = userInfo["aps"] as? [String: Any],
                   let contentAvailable = aps["content-available"] as? Int,
                   contentAvailable == 1 {
                    print("📦 Data-only message detected (content-available: 1), processing for widget update")
                    print("📦 Silent flag: \(isSilent ? "YES" : "NO")")
                    
                    // data-only 메시지 처리 (위젯 업데이트용)
                    // source_id를 id로 매핑 (sermon_event.py는 source_id를 사용하지만 Sermon 구조체는 id를 사용)
                    let id = (userInfo["source_id"] as? String) ?? (userInfo["id"] as? String)
                    
                    if let sermonId = id,
                       let title = userInfo["title"] as? String,
                       let content = userInfo["content"] as? String,
                       let date = userInfo["date"] as? String,
                       let dayOfWeek = userInfo["day_of_week"] as? String {
                        let category = userInfo["category"] as? String
                        
                        // createdAt/updatedAt 처리
                        var createdAt: FirestoreTimeStamp? = nil
                        var updatedAt: FirestoreTimeStamp? = nil
                        
                        if let createdStr = userInfo["created_at"] as? String {
                            createdAt = convertStringToTimestamp(createdStr)
                        }
                        if let updatedStr = userInfo["updated_at"] as? String {
                            updatedAt = convertStringToTimestamp(updatedStr)
                        }
                        
                        let sermon = Sermon(
                            id: sermonId,
                            title: title,
                            content: content,
                            date: date,
                            category: category,
                            dayOfWeek: dayOfWeek,
                            createdAt: createdAt,
                            updatedAt: updatedAt
                        )
                        
                        print("✅ Data-only: Parsed sermon - \(sermon.title)")
                        
                        print("📦 Data-only: Attempting to save to App Group...")
                        guard let userDefaults = UserDefaults(suiteName: "group.mannachurch.meditationblossom") else {
                            print("❌ Data-only: Failed to access App Group UserDefaults")
                            return
                        }
                        
                        print("✅ Data-only: App Group UserDefaults accessed successfully")
                        
                        let encoder = JSONEncoder()
                        do {
                            let encodedData = try encoder.encode(sermon)
                            guard let jsonString = String(data: encodedData, encoding: .utf8) else {
                                print("❌ Data-only: Failed to convert encoded data to UTF-8 string")
                                return
                            }
                            
                            print("✅ Data-only: Sermon encoded successfully")
                            print("   - JSON string length: \(jsonString.count) characters")
                            
                            userDefaults.set(jsonString, forKey: "displaySermon")
                            userDefaults.set(jsonString, forKey: "fcm_sermon")
                            let syncResult = userDefaults.synchronize()
                            print("✅ Data-only: Stored sermon in App Group, sync result: \(syncResult)")
                            
                            // 저장 후 검증
                            let savedDisplaySermon = userDefaults.string(forKey: "displaySermon")
                            let savedFcmSermon = userDefaults.string(forKey: "fcm_sermon")
                            print("📦 Data-only: Verification after save:")
                            print("   - displaySermon exists: \(savedDisplaySermon != nil ? "YES (\(savedDisplaySermon?.count ?? 0) chars)" : "NO")")
                            print("   - fcm_sermon exists: \(savedFcmSermon != nil ? "YES (\(savedFcmSermon?.count ?? 0) chars)" : "NO")")
                            
                            WidgetCenter.shared.reloadTimelines(ofKind: "MeditationBlossomWidget")
                            print("✅ Data-only: Widget timeline reloaded")
                        } catch {
                            print("❌ Data-only: Failed to encode sermon: \(error.localizedDescription)")
                        }
                        
                        // silent 플래그가 있으면 알림을 완전히 숨김
                        if isSilent {
                            print("🔇 Silent mode: Suppressing notification display")
                            bestAttemptContent.title = ""
                            bestAttemptContent.body = ""
                            bestAttemptContent.sound = nil
                            bestAttemptContent.badge = nil
                            bestAttemptContent.categoryIdentifier = ""
                            // threadIdentifier도 제거하여 알림 그룹핑 방지
                            bestAttemptContent.threadIdentifier = ""
                        } else {
                            // silent 플래그가 없으면 일반 알림 표시
                            bestAttemptContent.sound = nil
                            bestAttemptContent.badge = nil
                        }
                        contentHandler(bestAttemptContent)
                        return
                    }
                }
                
                print("ℹ️ No widgetkit found and not a data-only message, checking for sermon_event message...")
                
                // sendSermonEventMessage() 형식 확인 (alert 타입이지만 content-available도 true)
                // sermon_event.py의 _send_to_topic() 구조와 동일한 메시지
                if let aps = userInfo["aps"] as? [String: Any],
                   let alert = aps["alert"] as? [String: Any],
                   let contentAvailable = aps["content-available"] as? Int,
                   contentAvailable == 1 {
                    print("📦 Sermon Event message detected (alert + content-available: 1)")
                    print("📦 Processing sermon_event.py format message...")
                    
                    // source_id를 id로 매핑 (sermon_event.py는 source_id를 사용하지만 Sermon 구조체는 id를 사용)
                    let id = (userInfo["source_id"] as? String) ?? (userInfo["id"] as? String)
                    
                    guard let sermonId = id,
                          let title = userInfo["title"] as? String,
                          let content = userInfo["content"] as? String,
                          let date = userInfo["date"] as? String,
                          let dayOfWeek = userInfo["day_of_week"] as? String else {
                        print("❌ Sermon Event: Required fields missing (source_id/id, title, content, date, day_of_week)")
                        contentHandler(bestAttemptContent)
                        return
                    }
                    
                    let category = userInfo["category"] as? String
                    
                    // createdAt/updatedAt 처리
                    var createdAt: FirestoreTimeStamp? = nil
                    var updatedAt: FirestoreTimeStamp? = nil
                    
                    if let createdStr = userInfo["created_at"] as? String {
                        createdAt = convertStringToTimestamp(createdStr)
                    }
                    if let updatedStr = userInfo["updated_at"] as? String {
                        updatedAt = convertStringToTimestamp(updatedStr)
                    }
                    
                    let sermon = Sermon(
                        id: sermonId,
                        title: title,
                        content: content,
                        date: date,
                        category: category,
                        dayOfWeek: dayOfWeek,
                        createdAt: createdAt,
                        updatedAt: updatedAt
                    )
                    
                    print("✅ Sermon Event: Parsed sermon - \(sermon.title)")
                    
                    // App Group에 저장
                    print("📦 Sermon Event: Attempting to save to App Group...")
                    guard let userDefaults = UserDefaults(suiteName: "group.mannachurch.meditationblossom") else {
                        print("❌ Sermon Event: Failed to access App Group UserDefaults")
                        contentHandler(bestAttemptContent)
                        return
                    }
                    
                    print("✅ Sermon Event: App Group UserDefaults accessed successfully")
                    
                    let encoder = JSONEncoder()
                    do {
                        let encodedData = try encoder.encode(sermon)
                        guard let jsonString = String(data: encodedData, encoding: .utf8) else {
                            print("❌ Sermon Event: Failed to convert encoded data to UTF-8 string")
                            contentHandler(bestAttemptContent)
                            return
                        }
                        
                        print("✅ Sermon Event: Sermon encoded successfully")
                        print("   - JSON string length: \(jsonString.count) characters")
                        
                        userDefaults.set(jsonString, forKey: "displaySermon")
                        userDefaults.set(jsonString, forKey: "fcm_sermon")
                        let syncResult = userDefaults.synchronize()
                        print("✅ Sermon Event: Stored sermon in App Group, sync result: \(syncResult)")
                        
                        // 저장 후 검증
                        let savedDisplaySermon = userDefaults.string(forKey: "displaySermon")
                        let savedFcmSermon = userDefaults.string(forKey: "fcm_sermon")
                        print("📦 Sermon Event: Verification after save:")
                        print("   - displaySermon exists: \(savedDisplaySermon != nil ? "YES (\(savedDisplaySermon?.count ?? 0) chars)" : "NO")")
                        print("   - fcm_sermon exists: \(savedFcmSermon != nil ? "YES (\(savedFcmSermon?.count ?? 0) chars)" : "NO")")
                        
                        // 위젯 업데이트 트리거
                        WidgetCenter.shared.reloadTimelines(ofKind: "MeditationBlossomWidget")
                        print("✅ Sermon Event: Widget timeline reloaded")
                    } catch {
                        print("❌ Sermon Event: Failed to encode sermon: \(error.localizedDescription)")
                    }
                    
                    // alert가 있으므로 알림은 표시됨 (bestAttemptContent는 그대로 사용)
                    contentHandler(bestAttemptContent)
                    return
                }
                
                print("ℹ️ Not a sermon_event message, treating as regular FCM message")
            }
            
            // 일반 FCM 메시지 처리 (WidgetKit Push가 아니고 data-only도 아니고 sermon_event도 아닌 경우)
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
        print("📦 WidgetKit Push: Attempting to save to App Group...")
        guard let userDefaults = UserDefaults(suiteName: "group.mannachurch.meditationblossom") else {
            print("❌ WidgetKit Push: Failed to access App Group UserDefaults")
            return
        }
        
        print("✅ WidgetKit Push: App Group UserDefaults accessed successfully")
        
        let encoder = JSONEncoder()
        do {
            let encodedData = try encoder.encode(sermon)
            guard let jsonString = String(data: encodedData, encoding: .utf8) else {
                print("❌ WidgetKit Push: Failed to convert encoded data to UTF-8 string")
                print("   - Encoded data length: \(encodedData.count) bytes")
                return
            }
            
            print("✅ WidgetKit Push: Sermon encoded successfully")
            print("   - JSON string length: \(jsonString.count) characters")
            print("   - Content preview (first 200 chars): \(String(jsonString.prefix(200)))")
            
            // 저장 전 기존 데이터 확인
            let existingDisplaySermon = userDefaults.string(forKey: "displaySermon")
            let existingFcmSermon = userDefaults.string(forKey: "fcm_sermon")
            print("📦 WidgetKit Push: Existing data in App Group:")
            print("   - displaySermon exists: \(existingDisplaySermon != nil ? "YES (\(existingDisplaySermon?.count ?? 0) chars)" : "NO")")
            print("   - fcm_sermon exists: \(existingFcmSermon != nil ? "YES (\(existingFcmSermon?.count ?? 0) chars)" : "NO")")
            
            // displaySermon과 fcm_sermon 둘 다 저장 (호환성)
            print("📦 WidgetKit Push: Setting displaySermon...")
            userDefaults.set(jsonString, forKey: "displaySermon")
            print("✅ WidgetKit Push: displaySermon set")
            
            print("📦 WidgetKit Push: Setting fcm_sermon...")
            userDefaults.set(jsonString, forKey: "fcm_sermon")
            print("✅ WidgetKit Push: fcm_sermon set")
            
            print("📦 WidgetKit Push: Synchronizing App Group...")
            let syncResult = userDefaults.synchronize()
            print("✅ WidgetKit Push: Synchronize result: \(syncResult)")
            
            // 저장 후 검증
            let savedDisplaySermon = userDefaults.string(forKey: "displaySermon")
            let savedFcmSermon = userDefaults.string(forKey: "fcm_sermon")
            print("📦 WidgetKit Push: Verification after save:")
            print("   - displaySermon exists: \(savedDisplaySermon != nil ? "YES (\(savedDisplaySermon?.count ?? 0) chars)" : "NO")")
            print("   - fcm_sermon exists: \(savedFcmSermon != nil ? "YES (\(savedFcmSermon?.count ?? 0) chars)" : "NO")")
            
            if savedDisplaySermon == jsonString && savedFcmSermon == jsonString {
                print("✅ WidgetKit Push: Data saved and verified successfully in App Group")
            } else {
                print("⚠️ WidgetKit Push: Data verification failed!")
                print("   - Original length: \(jsonString.count)")
                print("   - Saved displaySermon length: \(savedDisplaySermon?.count ?? 0)")
                print("   - Saved fcm_sermon length: \(savedFcmSermon?.count ?? 0)")
            }
            
            // WidgetKit Push payload에 reloadTimelines가 포함되어 있으면,
            // iOS 시스템이 자동으로 위젯의 getTimeline()을 호출함
            // 데이터가 App Group에 저장되었으므로 위젯이 즉시 읽을 수 있음
            NSLog("📦 WidgetKit Push: Data saved to App Group")
            NSLog("📦 WidgetKit Push: Data is ready for widget to read")
            
            // reloadTimelines가 있는지 확인
            if let reloadTimelines = widgetkit["reloadTimelines"] as? [String] {
                NSLog("✅ WidgetKit Push: reloadTimelines found in payload - iOS will automatically call widget's getTimeline()")
                print("✅ WidgetKit Push: reloadTimelines found in payload - iOS will automatically call widget's getTimeline()")
            } else {
                NSLog("⚠️ WidgetKit Push: reloadTimelines NOT found in payload - Firebase may have removed it")
                NSLog("⚠️ WidgetKit Push: Will manually trigger widget update via WidgetCenter")
                print("⚠️ WidgetKit Push: reloadTimelines NOT found in payload - Firebase may have removed it")
                print("⚠️ WidgetKit Push: Will manually trigger widget update via WidgetCenter")
            }
            
            print("📦 WidgetKit Push: Data saved to App Group")
            print("📦 WidgetKit Push: Data is ready for widget to read")
            print("📦 WidgetKit Push: iOS will automatically call widget's getTimeline() via WidgetKit Push reloadTimelines")
            print("✅ WidgetKit Push: Widget should update immediately (even if app is fully terminated)")
            
            // Extension에서 수동으로 reloadTimelines를 호출
            // 앱이 완전히 종료된 상태에서는 작동하지 않을 수 있지만,
            // reloadTimelines가 없을 때는 수동 리로드가 유일한 방법
            NSLog("📦 WidgetKit Push: Calling WidgetCenter.shared.reloadTimelines() to trigger widget update")
            WidgetCenter.shared.reloadTimelines(ofKind: "MeditationBlossomWidget")
            NSLog("✅ WidgetKit Push: WidgetCenter.shared.reloadTimelines() called")
            print("📦 WidgetKit Push: Manual reloadTimelines called (backup, may not work if app is fully terminated)")
            
        } catch {
            print("❌ WidgetKit Push: Failed to encode sermon: \(error.localizedDescription)")
            print("   - Error details: \(error)")
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
