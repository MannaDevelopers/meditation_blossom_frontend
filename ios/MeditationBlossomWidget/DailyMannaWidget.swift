//
//  DailyMannaWidget.swift
//  MeditationBlossomWidget
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

// MARK: - Design Tokens

private enum WT {
  static let outerPad: CGFloat = 18
  static let innerGap: CGFloat = 6
  static let sectionGap: CGFloat = 10

  static let dateFontSize: CGFloat = 12
  static let titleFontSizeLarge: CGFloat = 17
  static let titleFontSizeMedium: CGFloat = 14
  static let refFontSize: CGFloat = 12
  static let verseFontSizeLarge: CGFloat = 15
  static let verseFontSizeMedium: CGFloat = 14
  static let questionFontSize: CGFloat = 14
  static let sectionLabelFontSize: CGFloat = 11

  // Colors (읽기 좋게: near-black 계열, 배경 gradient에 맞춤)
  static let primaryText = Color(red: 0.10, green: 0.10, blue: 0.10)
  static let secondaryText = Color(red: 0.10, green: 0.10, blue: 0.10).opacity(0.50)
  static let accentText = Color(red: 0.18, green: 0.42, blue: 0.25)   // 짙은 녹색 계열
  static let dividerColor = Color(red: 0.10, green: 0.10, blue: 0.10).opacity(0.12)
}

// MARK: - Timeline Entry

struct QTEntry: TimelineEntry {
  let date: Date
  let mergedTitle: String
  let dateLabel: String
  let reference: String
  let verses: [String]
  let meditationQuestions: [String]
  let isSunday: Bool
  let videoUrl: String?
  let youtubeLinkEnabled: Bool

  var targetURL: URL {
    if youtubeLinkEnabled {
      if let urlStr = videoUrl, let url = URL(string: urlStr) { return url }
      return DailyMannaWidgetConstants.fallbackYoutubeUrl
    }
    return DailyMannaWidgetConstants.deepLinkDailyManna
  }
}

// 매일만나 말씀(DailyMannaContentEntryView)과 묵상질문(DailyMannaMeditationEntryView)
// 위젯이 이 emptyQTEntry를 공유한다. 말씀 위젯은 verses를, 묵상질문 위젯은
// meditationQuestions를 본문에 표시하므로, 안내 문구를 두 필드 모두에 넣어야
// 두 위젯 모두에서 보인다.
private let widgetInstalledGuideMessage = "묵상만개 앱을 한 번 실행해서 위젯을 활성화 해주세요. 내용이 자동으로 업데이트 됩니다"

private let emptyQTEntry = QTEntry(
  date: Date(),
  mergedTitle: "QT 위젯 설치 완료!",
  dateLabel: "",
  reference: "",
  verses: [widgetInstalledGuideMessage],
  meditationQuestions: [widgetInstalledGuideMessage],
  isSunday: false,
  videoUrl: nil,
  youtubeLinkEnabled: false
)

// MARK: - Verse Parser

private func parseQTContent(_ content: String) -> (reference: String, verses: [String]) {
  // 책 이름 토큰은 \S+로 매칭 — "요한1서"처럼 이름에 숫자가 포함된 경우
  // [^\d\s]+(숫자 제외)로는 "1" 앞에서 끊겨 "서 4:1"처럼 잘못 파싱되는 문제가 있어 수정함
  let pattern = #"(본문\s*[:：]?\s*)?(\S+ ?\d+:\d+(?:-\d+)?(?:,\s*\S+ ?\d+:\d+(?:-\d+)?)*)"#
  guard let regex = try? NSRegularExpression(pattern: pattern),
        let match = regex.firstMatch(in: content, range: NSRange(content.startIndex..., in: content))
  else { return (reference: "", verses: content.isEmpty ? [] : [content]) }

  var reference = ""
  if let r = Range(match.range(at: 2), in: content) {
    reference = String(content[r]).trimmingCharacters(in: .whitespaces)
  }

  let afterRef = String(content[content.index(content.startIndex, offsetBy: match.range.location + match.range.length)...])
    .trimmingCharacters(in: .whitespacesAndNewlines)
  guard !afterRef.isEmpty else { return (reference: reference, verses: []) }

  guard let vRegex = try? NSRegularExpression(pattern: #"\d+"#) else {
    return (reference: reference, verses: [afterRef])
  }
  let ms = vRegex.matches(in: afterRef, range: NSRange(afterRef.startIndex..., in: afterRef))
  guard !ms.isEmpty else { return (reference: reference, verses: [afterRef]) }

  var verses: [String] = []
  for i in 0..<ms.count {
    guard let cur = Range(ms[i].range, in: afterRef) else { continue }
    let text: String
    if i < ms.count - 1, let next = Range(ms[i+1].range, in: afterRef) {
      text = String(afterRef[cur.upperBound..<next.lowerBound]).trimmingCharacters(in: .whitespacesAndNewlines)
    } else {
      text = String(afterRef[cur.upperBound...]).trimmingCharacters(in: .whitespacesAndNewlines)
    }
    verses.append("\(String(afterRef[cur])) \(text)")
  }
  return (reference: reference, verses: verses)
}

// MARK: - Timeline Provider

@available(iOS 16.0, *)
struct QTProvider: TimelineProvider {
  func placeholder(in context: Context) -> QTEntry { emptyQTEntry }

  func getSnapshot(in context: Context, completion: @escaping (QTEntry) -> Void) {
    completion(createQTEntry())
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<QTEntry>) -> Void) {
    let entry = createQTEntry()
    let next = Calendar.current.startOfDay(for: Date()).addingTimeInterval(24 * 60 * 60)
    completion(Timeline(entries: [entry], policy: .after(next)))
  }

  private func createQTEntry() -> QTEntry {
    guard let defaults = UserDefaults(suiteName: DailyMannaWidgetConstants.appGroupId),
          let qt: QT = defaults.getObjectFromString(forKey: DailyMannaWidgetConstants.fcmQtKey, castTo: QT.self)
    else { return emptyQTEntry }

    let (reference, verses) = parseQTContent(qt.content)
    return QTEntry(
      date: Date(),
      mergedTitle: qt.mergedTitle,
      dateLabel: qt.dateLabel,
      reference: reference,
      verses: verses.isEmpty ? (qt.content.isEmpty ? ["오늘 말씀은 책을 참고해주세요"] : [qt.content]) : verses,
      meditationQuestions: qt.meditationQuestions,
      isSunday: qt.isSunday,
      videoUrl: qt.videoUrl,
      youtubeLinkEnabled: defaults.bool(forKey: DailyMannaWidgetConstants.youtubeLinkEnabledKey)
    )
  }
}

// MARK: - Shared Background

private struct QTWidgetBackground: View {
  let family: WidgetFamily
  var body: some View {
    Image(family == .systemLarge ? "background_364_382" : "background_364_170")
      .resizable()
      .aspectRatio(contentMode: .fill)
  }
}

// MARK: - 섹션 헤더 (accent bar + 라벨)

private struct SectionHeader: View {
  let title: String
  var body: some View {
    HStack(spacing: 5) {
      RoundedRectangle(cornerRadius: 1.5)
        .fill(WT.accentText)
        .frame(width: 3, height: 12)
      Text(title)
        .font(.system(size: WT.sectionLabelFontSize, weight: .semibold))
        .foregroundColor(WT.accentText)
    }
  }
}

// MARK: - Content Widget (말씀)

struct DailyMannaContentWidget: Widget {
  let kind: String = DailyMannaWidgetConstants.contentWidgetKind

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: QTProvider()) { entry in
      DailyMannaContentEntryView(entry: entry)
        .qtContainerBackground()
        .widgetURL(entry.targetURL)
    }
    .configurationDisplayName("매일만나 말씀")
    .description("오늘의 말씀을 홈 화면에서 바로 확인하세요.")
    .supportedFamilies([.systemMedium, .systemLarge])
  }
}

struct DailyMannaContentEntryView: View {
  var entry: QTEntry
  @Environment(\.widgetFamily) var family

  var body: some View {
    ZStack(alignment: .topLeading) {
      QTWidgetBackground(family: family)
      if family == .systemLarge { largeContent } else { mediumContent }
    }
  }

  // Large (364 × 382)
  private var largeContent: some View {
    VStack(alignment: .leading, spacing: 0) {
      if !entry.dateLabel.isEmpty {
        Text(entry.dateLabel)
          .font(.system(size: WT.dateFontSize, weight: .medium))
          .foregroundColor(WT.secondaryText)
      }

      HStack(alignment: .top) {
        Text(entry.mergedTitle)
          .font(.system(size: WT.titleFontSizeLarge, weight: .bold))
          .foregroundColor(WT.primaryText)
          .lineLimit(2)
        Spacer(minLength: 4)
        if entry.youtubeLinkEnabled {
          YoutubeMarkerView()
        }
      }
      .padding(.top, entry.dateLabel.isEmpty ? 0 : WT.innerGap)

      if !entry.reference.isEmpty {
        Text(entry.reference)
          .font(.system(size: WT.refFontSize, weight: .semibold))
          .foregroundColor(WT.accentText)
          .padding(.top, WT.innerGap)
      }

      Rectangle()
        .fill(WT.dividerColor)
        .frame(height: 1)
        .padding(.top, WT.sectionGap)

      Text(entry.verses.prefix(5).joined(separator: "\n\n"))
        .font(.system(size: WT.verseFontSizeLarge))
        .foregroundColor(WT.primaryText)
        .lineLimit(8)
        .lineSpacing(2)
        .padding(.top, WT.sectionGap)

      Spacer(minLength: 0)
    }
    .padding(EdgeInsets(top: WT.outerPad, leading: 24, bottom: WT.outerPad, trailing: 24))
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }

  // Medium (364 × 170)
  private var mediumContent: some View {
    VStack(alignment: .leading, spacing: WT.innerGap) {
      HStack(alignment: .firstTextBaseline) {
        Text(entry.mergedTitle)
          .font(.system(size: WT.titleFontSizeMedium, weight: .bold))
          .foregroundColor(WT.primaryText)
          .lineLimit(1)
        if !entry.reference.isEmpty {
          Spacer(minLength: 4)
          Text(entry.reference)
            .font(.system(size: WT.refFontSize, weight: .semibold))
            .foregroundColor(WT.accentText)
            .lineLimit(1)
        }
        if entry.youtubeLinkEnabled {
          Spacer(minLength: 4)
          YoutubeMarkerView()
        }
      }
      .padding(.horizontal, WT.outerPad)
      .padding(.top, WT.outerPad)

      Rectangle()
        .fill(WT.dividerColor)
        .frame(height: 1)
        .padding(.horizontal, WT.outerPad)

      Text(entry.verses.joined(separator: " "))
        .font(.system(size: WT.verseFontSizeMedium))
        .foregroundColor(WT.primaryText)
        .lineLimit(4)
        .lineSpacing(1.5)
        .padding(.horizontal, WT.outerPad)

      Spacer(minLength: WT.outerPad)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }
}

// MARK: - Meditation Widget (묵상질문)

struct DailyMannaMeditationWidget: Widget {
  let kind: String = DailyMannaWidgetConstants.meditationWidgetKind

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: QTProvider()) { entry in
      DailyMannaMeditationEntryView(entry: entry)
        .qtContainerBackground()
        .widgetURL(entry.targetURL)
    }
    .configurationDisplayName("매일만나 묵상질문")
    .description("오늘의 묵상질문을 홈 화면에서 바로 확인하세요.")
    .supportedFamilies([.systemMedium, .systemLarge])
  }
}

struct DailyMannaMeditationEntryView: View {
  var entry: QTEntry
  @Environment(\.widgetFamily) var family

  private var hasQuestions: Bool { !entry.isSunday && !entry.meditationQuestions.isEmpty }
  private var noQuestionsText: String {
    entry.isSunday ? "주일은 묵상 질문이 없습니다" : "오늘은 묵상 질문이 없습니다"
  }

  // meditationQuestions의 각 항목은 "주요 질문\n❶ 하위 질문\n❷ 하위 질문" 형태로
  // 줄바꿈이 포함된 경우가 있어, 줄 단위로 펼쳐서 메인 앱과 동일하게 표시한다.
  private var meditationLines: [String] {
    entry.meditationQuestions.flatMap { question in
      question.split(separator: "\n", omittingEmptySubsequences: true).map(String.init)
    }
  }

  var body: some View {
    ZStack(alignment: .topLeading) {
      QTWidgetBackground(family: family)
      if family == .systemLarge { largeContent } else { mediumContent }
    }
  }

  // Large
  private var largeContent: some View {
    VStack(alignment: .leading, spacing: 0) {
      if !entry.dateLabel.isEmpty {
        Text(entry.dateLabel)
          .font(.system(size: WT.dateFontSize, weight: .medium))
          .foregroundColor(WT.secondaryText)
      }

      HStack(alignment: .top) {
        Text(entry.mergedTitle)
          .font(.system(size: WT.titleFontSizeLarge, weight: .bold))
          .foregroundColor(WT.primaryText)
          .lineLimit(2)
        Spacer(minLength: 4)
        if entry.youtubeLinkEnabled {
          YoutubeMarkerView()
        }
      }
      .padding(.top, entry.dateLabel.isEmpty ? 0 : WT.innerGap)

      SectionHeader(title: "묵상 질문")
        .padding(.top, WT.sectionGap)

      Rectangle()
        .fill(WT.dividerColor)
        .frame(height: 1)
        .padding(.top, WT.innerGap)

      if hasQuestions {
        VStack(alignment: .leading, spacing: 6) {
          ForEach(Array(meditationLines.prefix(6).enumerated()), id: \.offset) { idx, line in
            HStack(alignment: .top, spacing: 2) {
              Text(idx == 0 ? "•" : "")
                .font(.system(size: WT.questionFontSize, weight: .semibold))
                .foregroundColor(WT.accentText)
                .frame(width: 18, alignment: .leading)
              Text(line)
                .font(.system(size: WT.questionFontSize))
                .foregroundColor(WT.primaryText)
                .lineLimit(2)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
          }
        }
        .padding(.top, WT.sectionGap)
      } else {
        Text(noQuestionsText)
          .font(.system(size: WT.questionFontSize))
          .foregroundColor(WT.secondaryText)
          .padding(.top, WT.sectionGap)
      }

      Spacer(minLength: 0)
    }
    .padding(EdgeInsets(top: WT.outerPad, leading: 24, bottom: WT.outerPad, trailing: 24))
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }

  // Medium
  private var mediumContent: some View {
    VStack(alignment: .leading, spacing: WT.innerGap) {
      HStack(alignment: .center) {
        SectionHeader(title: "묵상 질문")
        Spacer(minLength: 6)
        Text(entry.mergedTitle)
          .font(.system(size: 12, weight: .bold))
          .foregroundColor(WT.primaryText)
          .lineLimit(1)
        if entry.youtubeLinkEnabled {
          Spacer(minLength: 4)
          YoutubeMarkerView()
        }
      }
      .padding(.horizontal, WT.outerPad)
      .padding(.top, WT.outerPad)

      Rectangle()
        .fill(WT.dividerColor)
        .frame(height: 1)
        .padding(.horizontal, WT.outerPad)

      if hasQuestions {
        VStack(alignment: .leading, spacing: 5) {
          ForEach(Array(meditationLines.prefix(4).enumerated()), id: \.offset) { idx, line in
            HStack(alignment: .top, spacing: 2) {
              Text(idx == 0 ? "•" : "")
                .font(.system(size: WT.questionFontSize, weight: .semibold))
                .foregroundColor(WT.accentText)
                .frame(width: 16, alignment: .leading)
              Text(line)
                .font(.system(size: WT.questionFontSize))
                .foregroundColor(WT.primaryText)
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
          }
        }
        .padding(.horizontal, WT.outerPad)
      } else {
        Text(noQuestionsText)
          .font(.system(size: WT.questionFontSize))
          .foregroundColor(WT.secondaryText)
          .padding(.horizontal, WT.outerPad)
      }

      Spacer(minLength: WT.outerPad)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }
}

// MARK: - iOS 16/17 containerBackground 헬퍼

extension View {
  func qtContainerBackground() -> some View {
    if #available(iOS 17.0, *) {
      return AnyView(self.containerBackground(.fill.tertiary, for: .widget))
    } else {
      return AnyView(self.background(Color.clear))
    }
  }

  func qtWidgetBackground(_ color: Color) -> some View {
    if #available(iOS 17.0, *) {
      return AnyView(self.containerBackground(for: .widget) { color })
    } else {
      return AnyView(self.background(color))
    }
  }
}
