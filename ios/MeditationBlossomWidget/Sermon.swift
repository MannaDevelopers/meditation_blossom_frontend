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
}

extension UserDefaults {
    // JSON String을 Codable 객체로 변환하여 불러오는 함수
    func getObjectFromString<T: Codable>(forKey key: String, castTo type: T.Type) -> T? {
        // UserDefaults에서 저장된 JSON 문자열을 가져옴
        guard let jsonString = self.string(forKey: key) else {
            print("'\(key)'에 해당하는 문자열을 찾을 수 없습니다.")
            return nil
        }
        guard let data = jsonString.data(using: .utf8) else {
              print("문자열을 Data로 변환하는 데 실패했습니다.")
              return nil
        }
        print(jsonString)
        // Swift 객체로 디코딩
        do {
          let decoder = JSONDecoder()
          let object = try decoder.decode(type, from: data)
            return object
        } catch {
            print("JSON 디코딩 실패: \(error.localizedDescription)")
            return nil
        }
    }
}
