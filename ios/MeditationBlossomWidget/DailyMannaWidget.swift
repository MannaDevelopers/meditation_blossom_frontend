//
//  DailyMannaWidget.swift
//  MeditationBlossomWidget
//
//  Created by 최상준 on 5/31/25.
//

import WidgetKit
import SwiftUI
import Foundation

// MARK: - Constants

private enum DailyMannaWidgetConstants {
  static let appGroupId = "group.mannachurch.meditationblossom"
  static let fcmQtKey = "fcm_qt"
  static let youtubeLinkEnabledKey = "youtube_link_enabled"
  static let fallbackYoutubeUrl = URL(string: "https://www.youtube.com/@만나")!
  static let deepLinkDailyManna = URL(string: "meditationblossom://open?tab=daily_manna")!
  static let contentWidgetKind = "DailyMannaContentWidget"
  static let meditationWidgetKind = "DailyMannaMeditationWidget"
}

// MARK: - Timeline Entry

struct QTEntry: TimelineEntry {
  let date: Date
  let mergedTitle: String
  let dateLabel: String
  let reference: String      // 성경 본문 참조 (예: "에베소서 5:15-16")
  let verses: [String]       // 파싱된 구절 목록
  let meditationQuestions: [String]
  let isSunday: Bool
  let videoUrl: String?
  let youtubeLinkEnabled: Bool

  var targetURL: URL {
    if youtubeLinkEnabled {
      if let urlStr = videoUrl, let url = URL(string: urlStr) {
        return url
      }
      return DailyMannaWidgetConstants.fallbackYoutubeUrl
    }
    return DailyMannaWidgetConstants.deepLinkDailyManna
  }
}

private let emptyQTEntry = QTEntry(
  date: Date(),
  mergedTitle: " ",
  dateLabel: " ",
  reference: " ",
  verses: ["등록된 QT가 없습니다"],
  meditationQuestions: [],
  isSunday: false,
  videoUrl: nil,
  youtubeLinkEnabled: false
)

// MARK: - Verse Parser

/// 성경 본문에서 책/장/절 참조와 구절 텍스트를 파싱
private func parseQTContent(_ content: String) -> (reference: String, verses: [String]) {
  let bookNamePattern = #"(본문\s*[:：]?\s*)?([^\d\s]+ ?\d+:\d+(?:-\d+)?(?:,\s*[^\d\s]+ ?\d+:\d+(?:-\d+)?)*)"#

  guard let bookNameRegex = try? NSRegularExpression(pattern: bookNamePattern, options: []),
        let match = bookNameRegex.firstMatch(
          in: content, options: [],
          range: NSRange(content.startIndex..., in: content))
  else {
    return (reference: "", verses: content.isEmpty ? [] : [content])
  }

  var reference = ""
  if let refRange = Range(match.range(at: 2), in: content) {
    reference = String(content[refRange]).trimmingCharacters(in: .whitespaces)
  }

  let contentStartIndex = content.index(
    content.startIndex, offsetBy: match.range.location + match.range.length)
  let contentAfterRef = String(content[contentStartIndex...])
    .trimmingCharacters(in: .whitespacesAndNewlines)

  guard !contentAfterRef.isEmpty else {
    return (reference: reference, verses: [])
  }

  // 구절 번호로 분리
  let versePattern = #"\d+"#
  guard let verseRegex = try? NSRegularExpression(pattern: versePattern, options: []) else {
    return (reference: reference, verses: [contentAfterRef])
  }

  let verseMatches = verseRegex.matches(
    in: contentAfterRef, options: [],
    range: NSRange(contentAfterRef.startIndex..., in: contentAfterRef))

  guard !verseMatches.isEmpty else {
    return (reference: reference, verses: [contentAfterRef])
  }

  var verses: [String] = []
  for i in 0..<verseMatches.count {
    let currentMatch = verseMatches[i]
    guard let currentRange = Range(currentMatch.range, in: contentAfterRef) else { continue }
    let verseEndIndex = currentRange.upperBound

    let verseText: String
    if i < verseMatches.count - 1,
       let nextRange = Range(verseMatches[i + 1].range, in: contentAfterRef) {
      verseText = String(contentAfterRef[verseEndIndex..<nextRange.lowerBound])
        .trimmingCharacters(in: .whitespacesAndNewlines)
    } else {
      verseText = String(contentAfterRef[verseEndIndex...])
        .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    let verseNumber = String(contentAfterRef[currentRange])
    verses.append("\(verseNumber) \(verseText)")
  }

  return (reference: reference, verses: verses)
}

// MARK: - Timeline Provider

@available(iOS 16.0, *)
struct QTProvider: TimelineProvider {
  func placeholder(in context: Context) -> QTEntry {
    emptyQTEntry
  }

  func getSnapshot(in context: Context, completion: @escaping (QTEntry) -> Void) {
    completion(createQTEntry())
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<QTEntry>) -> Void) {
    let entry = createQTEntry()
    let nextUpdateDate = Date().addingTimeInterval(24 * 60 * 60)
    let timeline = Timeline(entries: [entry], policy: .after(nextUpdateDate))
    completion(timeline)
  }

  private func createQTEntry() -> QTEntry {
    guard let sharedDefaults = UserDefaults(suiteName: DailyMannaWidgetConstants.appGroupId) else {
      NSLog("DailyMannaWidget: Failed to access App Group UserDefaults")
      return emptyQTEntry
    }

    guard let qt: QT = sharedDefaults.getObjectFromString(
      forKey: DailyMannaWidgetConstants.fcmQtKey, castTo: QT.self)
    else {
      NSLog("DailyMannaWidget: No QT data in App Group")
      return emptyQTEntry
    }

    NSLog("DailyMannaWidget: Found QT - %@ (ID: %@)", qt.title, qt.id)

    let (reference, verses) = parseQTContent(qt.content)
    let youtubeLinkEnabled = sharedDefaults.bool(
      forKey: DailyMannaWidgetConstants.youtubeLinkEnabledKey)

    return QTEntry(
      date: Date(),
      mergedTitle: qt.mergedTitle,
      dateLabel: qt.dateLabel,
      reference: reference,
      verses: verses.isEmpty ? [qt.content] : verses,
      meditationQuestions: qt.meditationQuestions,
      isSunday: qt.isSunday,
      videoUrl: qt.videoUrl,
      youtubeLinkEnabled: youtubeLinkEnabled
    )
  }
}

// MARK: - Content Widget (말씀 위젯)

struct DailyMannaContentWidget: Widget {
  let kind: String = DailyMannaWidgetConstants.contentWidgetKind

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: QTProvider()) { entry in
      if #available(iOS 17.0, *) {
        DailyMannaContentEntryView(entry: entry)
          .containerBackground(.fill.tertiary, for: .widget)
          .widgetURL(entry.targetURL)
      } else {
        DailyMannaContentEntryView(entry: entry)
          .widgetURL(entry.targetURL)
      }
    }
    .configurationDisplayName("매일만나 말씀")
    .description("오늘의 QT 말씀을 홈 화면에서 바로 확인하세요.")
    .supportedFamilies([.systemMedium, .systemLarge])
  }
}

// MARK: - Content Widget View

struct DailyMannaContentEntryView: View {
  var entry: QTEntry
  @Environment(\.widgetFamily) var family

  var body: some View {
    Group {
      switch family {
      case .systemLarge:
        largeView
      default:
        mediumView
      }
    }
    .qtWidgetBackground(Color.clear)
  }

  // Large: 날짜 + 제목 + 본문 참조 + 구절 텍스트 (최대 5줄)
  private var largeView: some View {
    ZStack(alignment: .topLeading) {
      Image("background_364_382")
        .resizable()
        .frame(width: 364, height: 382)

      VStack(alignment: .leading, spacing: 0) {
        if !entry.dateLabel.trimmingCharacters(in: .whitespaces).isEmpty {
          Text(entry.dateLabel)
            .font(.system(size: 13))
            .foregroundColor(.black.opacity(0.6))
            .padding(.top, 30)
            .padding(.leading, 30)
        }

        Text(entry.mergedTitle)
          .font(.system(size: 18, weight: .bold))
          .foregroundColor(.black)
          .lineLimit(2)
          .padding(.top, entry.dateLabel.trimmingCharacters(in: .whitespaces).isEmpty ? 30 : 6)
          .padding(.leading, 30)
          .padding(.trailing, 30)

        if !entry.reference.trimmingCharacters(in: .whitespaces).isEmpty {
          Text(entry.reference)
            .font(.system(size: 13))
            .foregroundColor(.black.opacity(0.6))
            .padding(.top, 10)
            .padding(.leading, 30)
        }

        Text(entry.verses.joined(separator: "\n\n"))
          .font(.system(size: 16, weight: .semibold))
          .foregroundColor(.black)
          .lineLimit(6)
          .padding(.top, 10)
          .padding(.leading, 30)
          .padding(.trailing, 30)

        Spacer()
      }
    }
  }

  // Medium: 제목 + 구절 (간결하게)
  private var mediumView: some View {
    ZStack {
      Image("background_364_170")
        .resizable()
        .frame(width: 364, height: 170)

      VStack(alignment: .leading, spacing: 4) {
        Text(entry.mergedTitle)
          .font(.system(size: 14, weight: .bold))
          .foregroundColor(.black)
          .lineLimit(1)
          .frame(maxWidth: .infinity, alignment: .leading)
          .padding(.horizontal, 20)

        if !entry.reference.trimmingCharacters(in: .whitespaces).isEmpty {
          Text(entry.reference)
            .font(.system(size: 12))
            .foregroundColor(.black.opacity(0.6))
            .lineLimit(1)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 20)
        }

        Text(entry.verses.joined(separator: " "))
          .font(.system(size: 16, weight: .semibold))
          .foregroundColor(.black)
          .lineLimit(4)
          .frame(maxWidth: .infinity, alignment: .leading)
          .padding(.horizontal, 20)
      }
    }
  }
}

// MARK: - Meditation Widget (묵상질문 위젯)

struct DailyMannaMeditationWidget: Widget {
  let kind: String = DailyMannaWidgetConstants.meditationWidgetKind

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: QTProvider()) { entry in
      if #available(iOS 17.0, *) {
        DailyMannaMeditationEntryView(entry: entry)
          .containerBackground(.fill.tertiary, for: .widget)
          .widgetURL(entry.targetURL)
      } else {
        DailyMannaMeditationEntryView(entry: entry)
          .widgetURL(entry.targetURL)
      }
    }
    .configurationDisplayName("매일만나 묵상질문")
    .description("오늘의 QT 묵상질문을 홈 화면에서 바로 확인하세요.")
    .supportedFamilies([.systemMedium, .systemLarge])
  }
}

// MARK: - Meditation Widget View

struct DailyMannaMeditationEntryView: View {
  var entry: QTEntry
  @Environment(\.widgetFamily) var family

  /// 묵상 질문이 없거나 일요일인 경우
  private var noQuestionsMessage: String {
    "오늘은 묵상 질문이 없습니다"
  }

  private var hasQuestions: Bool {
    !entry.isSunday && !entry.meditationQuestions.isEmpty
  }

  var body: some View {
    Group {
      switch family {
      case .systemLarge:
        largeView
      default:
        mediumView
      }
    }
    .qtWidgetBackground(Color.clear)
  }

  // Large: 날짜 + 제목 + 묵상질문 목록 (bullet)
  private var largeView: some View {
    ZStack(alignment: .topLeading) {
      Image("background_364_382")
        .resizable()
        .frame(width: 364, height: 382)

      VStack(alignment: .leading, spacing: 0) {
        if !entry.dateLabel.trimmingCharacters(in: .whitespaces).isEmpty {
          Text(entry.dateLabel)
            .font(.system(size: 13))
            .foregroundColor(.black.opacity(0.6))
            .padding(.top, 30)
            .padding(.leading, 30)
        }

        Text(entry.mergedTitle)
          .font(.system(size: 18, weight: .bold))
          .foregroundColor(.black)
          .lineLimit(2)
          .padding(.top, entry.dateLabel.trimmingCharacters(in: .whitespaces).isEmpty ? 30 : 6)
          .padding(.leading, 30)
          .padding(.trailing, 30)

        Spacer().frame(height: 12)

        Text("묵상 질문")
          .font(.system(size: 13))
          .foregroundColor(.black.opacity(0.6))
          .padding(.leading, 30)

        Spacer().frame(height: 8)

        if hasQuestions {
          VStack(alignment: .leading, spacing: 8) {
            ForEach(Array(entry.meditationQuestions.prefix(5).enumerated()), id: \.offset) { _, q in
              Text("• \(q)")
                .font(.system(size: 15))
                .foregroundColor(.black)
                .lineLimit(2)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 30)
            }
          }
        } else {
          Text(noQuestionsMessage)
            .font(.system(size: 15))
            .foregroundColor(.black.opacity(0.6))
            .padding(.leading, 30)
        }

        Spacer()
      }
    }
  }

  // Medium: 제목 + 첫 번째 질문 (간결하게)
  private var mediumView: some View {
    ZStack {
      Image("background_364_170")
        .resizable()
        .frame(width: 364, height: 170)

      VStack(alignment: .leading, spacing: 6) {
        HStack {
          Text("묵상 질문")
            .font(.system(size: 12))
            .foregroundColor(.black.opacity(0.6))
          Spacer()
          Text(entry.mergedTitle)
            .font(.system(size: 12, weight: .bold))
            .foregroundColor(.black)
            .lineLimit(1)
        }
        .padding(.horizontal, 20)

        if hasQuestions {
          VStack(alignment: .leading, spacing: 6) {
            ForEach(Array(entry.meditationQuestions.prefix(3).enumerated()), id: \.offset) { _, q in
              Text("• \(q)")
                .font(.system(size: 15))
                .foregroundColor(.black)
                .lineLimit(2)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
          }
          .padding(.horizontal, 20)
        } else {
          Text(noQuestionsMessage)
            .font(.system(size: 15))
            .foregroundColor(.black.opacity(0.6))
            .padding(.horizontal, 20)
        }
      }
    }
  }
}

// MARK: - Background Modifier (iOS 16 호환)

extension View {
  func qtWidgetBackground(_ color: Color) -> some View {
    if #available(iOS 17.0, *) {
      return AnyView(self.containerBackground(for: .widget) {
        color
      })
    } else {
      return AnyView(self.background(color))
    }
  }
}
