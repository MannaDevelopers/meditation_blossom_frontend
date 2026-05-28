//
//  QT.swift
//  MeditationBlossomWidget
//
//  Created by 최상준 on 5/31/25.
//

import Foundation

struct QT: Codable {
  let id: String
  let title: String
  let seriesTitle: String
  let content: String
  let date: String
  let dayOfWeek: String?
  let videoUrl: String?
  let meditationQuestions: [String]

  enum CodingKeys: String, CodingKey {
    case id, title, content, date
    case seriesTitle = "series_title"
    case dayOfWeek = "day_of_week"
    case videoUrl = "video_url"
    case meditationQuestions = "meditation_questions"
  }

  init(id: String, title: String, seriesTitle: String, content: String, date: String,
       dayOfWeek: String?, videoUrl: String?, meditationQuestions: [String]) {
    self.id = id
    self.title = title
    self.seriesTitle = seriesTitle
    self.content = content
    self.date = date
    self.dayOfWeek = dayOfWeek
    self.videoUrl = videoUrl
    self.meditationQuestions = meditationQuestions
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    id = try container.decode(String.self, forKey: .id)
    title = try container.decode(String.self, forKey: .title)
    seriesTitle = (try? container.decode(String.self, forKey: .seriesTitle)) ?? ""
    content = try container.decode(String.self, forKey: .content)
    date = (try? container.decode(String.self, forKey: .date)) ?? ""
    dayOfWeek = try? container.decode(String.self, forKey: .dayOfWeek)
    videoUrl = try? container.decode(String.self, forKey: .videoUrl)
    // meditation_questions는 string 배열로 저장 (useQtWidgetSync에서 파싱 후 저장)
    meditationQuestions = (try? container.decode([String].self, forKey: .meditationQuestions)) ?? []
  }

  /// 화면에 표시할 병합 제목 (예: "QT제목 / 시리즈제목")
  var mergedTitle: String {
    if seriesTitle.isEmpty { return title }
    return "\(title) / \(seriesTitle)"
  }

  /// 요일 한글 변환
  var dayOfWeekKorean: String? {
    let map: [String: String] = [
      "MON": "월", "TUE": "화", "WED": "수", "THU": "목",
      "FRI": "금", "SAT": "토", "SUN": "일",
    ]
    guard let dow = dayOfWeek else { return nil }
    return map[dow.uppercased()]
  }

  /// 날짜 레이블 (예: "4월 26일 · 화")
  var dateLabel: String {
    let inputFormatter = DateFormatter()
    inputFormatter.dateFormat = "yyyy-MM-dd"
    inputFormatter.locale = Locale(identifier: "ko_KR")

    let outputFormatter = DateFormatter()
    outputFormatter.dateFormat = "M월 d일"
    outputFormatter.locale = Locale(identifier: "ko_KR")

    guard let parsedDate = inputFormatter.date(from: date) else {
      return dayOfWeekKorean ?? ""
    }
    let dateStr = outputFormatter.string(from: parsedDate)
    if let dow = dayOfWeekKorean {
      return "\(dateStr) · \(dow)"
    }
    return dateStr
  }

  /// 일요일 여부
  var isSunday: Bool {
    return dayOfWeek?.uppercased() == "SUN"
  }
}
