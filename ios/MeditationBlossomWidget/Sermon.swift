//
//  Sermon.swift
//  meditation_blossom
//
//  Created by 최상준 on 6/17/25.
//
import Foundation

struct FirestoreTimeStamp: Codable {
  let seconds: Int64
  let nanoseconds: Int32
}

struct Sermon: Codable {
    let id: String
    let title: String
    let content: String
    let date: String
    let category: String? // Optional
    let dayOfWeek: String? // Optional + 이름 변경
    let createdAt: FirestoreTimeStamp? // 이름 변경
    let updatedAt: FirestoreTimeStamp? // 이름 변경

    // JSON의 키 이름과 Swift 구조체의 프로퍼티 이름을 매핑합니다.
    // 이름이 동일한 경우는 생략해도 되지만, 명시적으로 모두 작성하는 것이 좋습니다.
    enum CodingKeys: String, CodingKey {
        case id, title, content, date, category
        case dayOfWeek = "day_of_week"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
    
    // 기본 초기화 (PushNotificationService에서 사용)
    init(id: String, title: String, content: String, date: String, category: String?, dayOfWeek: String?, createdAt: FirestoreTimeStamp?, updatedAt: FirestoreTimeStamp?) {
        self.id = id
        self.title = title
        self.content = content
        self.date = date
        self.category = category
        self.dayOfWeek = dayOfWeek
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
    
    // ISO 문자열을 Firestore 타임스탬프로 변환하는 커스텀 디코딩
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        
        id = try container.decode(String.self, forKey: .id)
        title = try container.decode(String.self, forKey: .title)
        content = try container.decode(String.self, forKey: .content)
        date = try container.decode(String.self, forKey: .date)
        category = try container.decodeIfPresent(String.self, forKey: .category)
        dayOfWeek = try container.decodeIfPresent(String.self, forKey: .dayOfWeek)
        
        // createdAt 처리: ISO 문자열 또는 Firestore 타임스탬프
        if let createdAtString = try? container.decode(String.self, forKey: .createdAt) {
            createdAt = Self.convertIsoToTimestamp(isoString: createdAtString)
        } else {
            createdAt = try container.decodeIfPresent(FirestoreTimeStamp.self, forKey: .createdAt)
        }
        
        // updatedAt 처리: ISO 문자열 또는 Firestore 타임스탬프
        if let updatedAtString = try? container.decode(String.self, forKey: .updatedAt) {
            updatedAt = Self.convertIsoToTimestamp(isoString: updatedAtString)
        } else {
            updatedAt = try container.decodeIfPresent(FirestoreTimeStamp.self, forKey: .updatedAt)
        }
    }
    
    // ISO 문자열을 Firestore 타임스탬프로 변환
    private static func convertIsoToTimestamp(isoString: String) -> FirestoreTimeStamp? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        
        if let date = formatter.date(from: isoString) {
            let seconds = Int64(date.timeIntervalSince1970)
            let nanoseconds = Int32((date.timeIntervalSince1970 - Double(seconds)) * 1_000_000_000)
            return FirestoreTimeStamp(seconds: seconds, nanoseconds: nanoseconds)
        }
        
        return nil
    }
}

extension UserDefaults {
    // JSON String을 Codable 객체로 변환하여 불러오는 함수
    func getObjectFromString<T: Codable>(forKey key: String, castTo type: T.Type) -> T? {
        print("🔄 Widget: getObjectFromString called for key: \(key)")
        
        // UserDefaults에서 저장된 JSON 문자열을 가져옴
        guard let jsonString = self.string(forKey: key) else {
            print("❌ Widget: '\(key)'에 해당하는 문자열을 찾을 수 없습니다.")
            return nil
        }
        
        print("✅ Widget: Found string for key '\(key)'")
        print("   - String length: \(jsonString.count) characters")
        print("   - String preview (first 300 chars): \(String(jsonString.prefix(300)))")
        
        guard let data = jsonString.data(using: .utf8) else {
            print("❌ Widget: 문자열을 Data로 변환하는 데 실패했습니다.")
            print("   - String length: \(jsonString.count)")
            print("   - String encoding check failed")
            return nil
        }
        
        print("✅ Widget: String converted to Data successfully")
        print("   - Data length: \(data.count) bytes")
        
        // Swift 객체로 디코딩
        do {
            let decoder = JSONDecoder()
            print("🔄 Widget: Attempting to decode JSON...")
            let object = try decoder.decode(type, from: data)
            print("✅ Widget: JSON decoded successfully for key '\(key)'")
            return object
        } catch {
            print("❌ Widget: JSON 디코딩 실패: \(error.localizedDescription)")
            print("   - Error details: \(error)")
            
            // 디코딩 실패 시 더 상세한 정보 출력
            if let decodingError = error as? DecodingError {
                switch decodingError {
                case .dataCorrupted(let context):
                    print("   - Data corrupted: \(context.debugDescription)")
                    print("   - Coding path: \(context.codingPath)")
                case .keyNotFound(let key, let context):
                    print("   - Key not found: \(key.stringValue)")
                    print("   - Coding path: \(context.codingPath)")
                case .typeMismatch(let type, let context):
                    print("   - Type mismatch: expected \(type), got \(context.debugDescription)")
                    print("   - Coding path: \(context.codingPath)")
                case .valueNotFound(let type, let context):
                    print("   - Value not found: \(type), at \(context.codingPath)")
                @unknown default:
                    print("   - Unknown decoding error")
                }
            }
            
            return nil
        }
    }
}
