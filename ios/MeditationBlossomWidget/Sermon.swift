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
    let videoUrl: String? // 유튜브 영상 URL (optional)
    // sermons-v2(worship_type별 예배, [#306]) 전용 필드 — TS `Sermon` 타입과 동일하게 optional.
    // 레거시 sermon_events(_v2)/QT payload엔 없다.
    let worshipType: String?
    let week: String? // ISO 8601 week_number(예: "2026-W37")
    let bibleReferences: String? // Firestore bible_references 배열의 JSON 문자열([#173])

    enum CodingKeys: String, CodingKey {
        case id, title, content, date, category
        case dayOfWeek = "day_of_week"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case videoUrl = "video_url"
        case worshipType = "worship_type"
        case week
        case bibleReferences = "bible_references"
    }

    // 기본 초기화 (PushNotificationService에서 사용)
    init(id: String, title: String, content: String, date: String, category: String?, dayOfWeek: String?, createdAt: FirestoreTimeStamp?, updatedAt: FirestoreTimeStamp?, videoUrl: String? = nil, worshipType: String? = nil, week: String? = nil, bibleReferences: String? = nil) {
        self.id = id
        self.title = title
        self.content = content
        self.date = date
        self.category = category
        self.dayOfWeek = dayOfWeek
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.videoUrl = videoUrl
        self.worshipType = worshipType
        self.week = week
        self.bibleReferences = bibleReferences
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
        videoUrl = try container.decodeIfPresent(String.self, forKey: .videoUrl)
        worshipType = try container.decodeIfPresent(String.self, forKey: .worshipType)
        week = try container.decodeIfPresent(String.self, forKey: .week)
        bibleReferences = try container.decodeIfPresent(String.self, forKey: .bibleReferences)

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
        guard let jsonString = self.string(forKey: key) else {
            return nil
        }

        guard let data = jsonString.data(using: .utf8) else {
            NSLog("Widget: Failed to convert string to Data for key '%@'", key)
            return nil
        }

        do {
            return try JSONDecoder().decode(type, from: data)
        } catch {
            NSLog("Widget: JSON decoding failed for key '%@': %@", key, error.localizedDescription)
            return nil
        }
    }
}
