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

    enum CodingKeys: String, CodingKey {
        case id, title, content, date, category
        case dayOfWeek = "day_of_week"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case videoUrl = "video_url"
    }

    // 기본 초기화 (PushNotificationService에서 사용)
    init(id: String, title: String, content: String, date: String, category: String?, dayOfWeek: String?, createdAt: FirestoreTimeStamp?, updatedAt: FirestoreTimeStamp?, videoUrl: String? = nil) {
        self.id = id
        self.title = title
        self.content = content
        self.date = date
        self.category = category
        self.dayOfWeek = dayOfWeek
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.videoUrl = videoUrl
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

    /// 메인 앱을 한 번도 실행한 적 없는, 완전히 새로운 설치인지 판단한다.
    ///
    /// WidgetKit 익스텐션은 메인 앱과 별도 프로세스라 위젯을 추가하는 것만으로는
    /// `hasAppLaunched`가 세팅되지 않는다(메인 앱을 실제로 열어야만 세팅됨). 그래서
    /// 이 플래그가 아직 없는 앱 버전(v1.1.11 이전)을 쓰던 기존 사용자가 업데이트 후
    /// 앱을 다시 열기 전에 예전에 안 쓰던 위젯 타입(예: QT)을 처음 추가하면, 실제로는
    /// 오래된 사용자인데도 `hasAppLaunched`만 보면 "신규 설치"로 잘못 판단하게 된다.
    /// 그래서 다른 위젯 타입의 데이터가 이미 있는지도 함께 확인해, 하나라도 있으면
    /// (기존 사용자로 보고) 신규 설치로 간주하지 않는다.
    func isFreshWidgetInstall() -> Bool {
        if bool(forKey: "hasAppLaunched") { return false }
        if string(forKey: "displaySermon") != nil { return false }
        if string(forKey: "fcm_sermon") != nil { return false }
        if string(forKey: "fcm_qt") != nil { return false }
        return true
    }
}
