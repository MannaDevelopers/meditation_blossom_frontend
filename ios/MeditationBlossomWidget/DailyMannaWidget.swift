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
  static let widgetDesignQtKey = "widget_design_qt"
  static let fallbackYoutubeUrl = URL(string: "https://www.youtube.com/@만나")!
  static let deepLinkDailyManna = URL(string: "meditationblossom://open?tab=daily_manna")!
  static let contentWidgetKind = "DailyMannaContentWidget"
  static let meditationWidgetKind = "DailyMannaMeditationWidget"
}

// MARK: - Design Tokens

// 텍스트 색상/크기는 WidgetDesign(디자인 편집 기능)을 따른다 — 아래 레이아웃 토큰만 고정값.
// 라벨(날짜/장절 참조/"묵상 질문")은 본문 대비 축소 비율을 적용한다. src/components/WidgetPreview.tsx의
// BANNER_INDEX_SIZE_RATIO/CARD_INDEX_SIZE_RATIO, Android WidgetDesignRendering.kt와 동일 값.
private enum WT {
  static let outerPad: CGFloat = 10
  static let innerGap: CGFloat = 6
  static let sectionGap: CGFloat = 10

  static let bannerIndexSizeRatio: Double = 12.0 / 16.0
  static let cardIndexSizeRatio: Double = 11.0 / 14.0
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
  let design: WidgetDesign

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
  youtubeLinkEnabled: false,
  design: defaultWidgetDesign
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
    guard let defaults = UserDefaults(suiteName: DailyMannaWidgetConstants.appGroupId) else {
      return emptyQTEntry
    }
    let design = defaults.getObjectFromString(forKey: DailyMannaWidgetConstants.widgetDesignQtKey, castTo: WidgetDesign.self) ?? defaultWidgetDesign

    guard let qt: QT = defaults.getObjectFromString(forKey: DailyMannaWidgetConstants.fcmQtKey, castTo: QT.self) else {
      return QTEntry(
        date: emptyQTEntry.date,
        mergedTitle: emptyQTEntry.mergedTitle,
        dateLabel: emptyQTEntry.dateLabel,
        reference: emptyQTEntry.reference,
        verses: emptyQTEntry.verses,
        meditationQuestions: emptyQTEntry.meditationQuestions,
        isSunday: emptyQTEntry.isSunday,
        videoUrl: emptyQTEntry.videoUrl,
        youtubeLinkEnabled: emptyQTEntry.youtubeLinkEnabled,
        design: design
      )
    }

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
      youtubeLinkEnabled: defaults.bool(forKey: DailyMannaWidgetConstants.youtubeLinkEnabledKey),
      design: design
    )
  }
}

// MARK: - 섹션 헤더 (accent bar + 라벨)

private struct SectionHeader: View {
  let title: String
  let color: Color
  let fontSize: CGFloat
  var body: some View {
    HStack(spacing: 5) {
      RoundedRectangle(cornerRadius: 1.5)
        .fill(color)
        .frame(width: 3, height: 12)
      Text(title)
        .font(.system(size: fontSize, weight: .semibold))
        .foregroundColor(color)
    }
  }
}

// MARK: - Content Widget (말씀)

struct DailyMannaContentWidget: Widget {
  let kind: String = DailyMannaWidgetConstants.contentWidgetKind

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: QTProvider()) { entry in
      DailyMannaContentEntryView(entry: entry)
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

  private var onPhoto: Bool { entry.design.background.type == "gallery" }
  private var textColor: Color { hexColor(entry.design.text.color) }

  var body: some View {
    Group {
      if family == .systemLarge { largeContent } else { mediumContent }
    }
    .widgetContainerBackground(entry.design.background, defaultImageName: family == .systemLarge ? "background_364_382" : "background_364_170")
  }

  // Large (364 × 382)
  private var largeContent: some View {
    VStack(alignment: .leading, spacing: 0) {
      if !entry.dateLabel.isEmpty {
        Text(entry.dateLabel)
          .font(.system(size: CGFloat(entry.design.text.size) * WT.bannerIndexSizeRatio, weight: .medium))
          .foregroundColor(textColor)
          .widgetTextShadow(onPhoto: onPhoto)
      }

      HStack(alignment: .center) {
        Text(entry.mergedTitle)
          .font(.system(size: CGFloat(entry.design.text.size), weight: .bold))
          .foregroundColor(textColor)
          .lineLimit(2)
          .widgetTextShadow(onPhoto: onPhoto)
        Spacer(minLength: 4)
        if entry.youtubeLinkEnabled {
          // .center 정렬이어도 폰트 메트릭 특성상 살짝 아래로 치우쳐 보여서 위로 보정.
          YoutubeMarkerView()
            .offset(y: -1.5)
        }
      }
      .padding(.top, entry.dateLabel.isEmpty ? 0 : WT.innerGap)

      if !entry.reference.isEmpty {
        Text(entry.reference)
          .font(.system(size: CGFloat(entry.design.text.size) * WT.bannerIndexSizeRatio, weight: .semibold))
          .foregroundColor(textColor)
          .padding(.top, WT.innerGap)
          .widgetTextShadow(onPhoto: onPhoto)
      }

      Rectangle()
        .fill(dividerColor(onPhoto: onPhoto))
        .frame(height: 1)
        .padding(.top, WT.sectionGap)

      Text(entry.verses.prefix(5).joined(separator: "\n\n"))
        .font(.system(size: CGFloat(entry.design.text.size), weight: contentFontWeight(entry.design.text.weight)))
        .foregroundColor(textColor)
        .multilineTextAlignment(textAlignment(entry.design.text.align))
        .lineLimit(8)
        .lineSpacing(2)
        .frame(maxWidth: .infinity, alignment: frameAlignment(entry.design.text.align))
        .padding(.top, WT.sectionGap)
        .widgetTextShadow(onPhoto: onPhoto)

      Spacer(minLength: 0)
    }
    .padding(EdgeInsets(top: WT.outerPad, leading: 10, bottom: WT.outerPad, trailing: 10))
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }

  // Medium (364 × 170)
  private var mediumContent: some View {
    VStack(alignment: .leading, spacing: WT.innerGap) {
      // QT 묵상질문 위젯과 동일하게 .center 정렬로 마커를 배치한다.
      HStack(alignment: .center) {
        Text(entry.mergedTitle)
          .font(.system(size: CGFloat(entry.design.text.size), weight: .bold))
          .foregroundColor(textColor)
          .lineLimit(1)
          .widgetTextShadow(onPhoto: onPhoto)
        if !entry.reference.isEmpty {
          Spacer(minLength: 4)
          Text(entry.reference)
            .font(.system(size: CGFloat(entry.design.text.size) * WT.cardIndexSizeRatio, weight: .semibold))
            .foregroundColor(textColor)
            .lineLimit(1)
            .widgetTextShadow(onPhoto: onPhoto)
        }
        if entry.youtubeLinkEnabled {
          Spacer(minLength: 4)
          YoutubeMarkerView()
        }
      }
      .padding(.horizontal, WT.outerPad)
      .padding(.top, WT.outerPad)

      Rectangle()
        .fill(dividerColor(onPhoto: onPhoto))
        .frame(height: 1)
        .padding(.horizontal, WT.outerPad)

      Text(entry.verses.joined(separator: " "))
        .font(.system(size: CGFloat(entry.design.text.size), weight: contentFontWeight(entry.design.text.weight)))
        .foregroundColor(textColor)
        .multilineTextAlignment(textAlignment(entry.design.text.align))
        .lineLimit(4)
        .lineSpacing(1.5)
        .frame(maxWidth: .infinity, alignment: frameAlignment(entry.design.text.align))
        .padding(.horizontal, WT.outerPad)
        .widgetTextShadow(onPhoto: onPhoto)

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

  private var onPhoto: Bool { entry.design.background.type == "gallery" }
  private var textColor: Color { hexColor(entry.design.text.color) }

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
    Group {
      if family == .systemLarge { largeContent } else { mediumContent }
    }
    .widgetContainerBackground(entry.design.background, defaultImageName: family == .systemLarge ? "background_364_382" : "background_364_170")
  }

  // Large
  private var largeContent: some View {
    VStack(alignment: .leading, spacing: 0) {
      if !entry.dateLabel.isEmpty {
        Text(entry.dateLabel)
          .font(.system(size: CGFloat(entry.design.text.size) * WT.bannerIndexSizeRatio, weight: .medium))
          .foregroundColor(textColor)
          .widgetTextShadow(onPhoto: onPhoto)
      }

      HStack(alignment: .center) {
        Text(entry.mergedTitle)
          .font(.system(size: CGFloat(entry.design.text.size), weight: .bold))
          .foregroundColor(textColor)
          .lineLimit(2)
          .widgetTextShadow(onPhoto: onPhoto)
        Spacer(minLength: 4)
        if entry.youtubeLinkEnabled {
          // .center 정렬이어도 폰트 메트릭 특성상 살짝 아래로 치우쳐 보여서 위로 보정.
          YoutubeMarkerView()
            .offset(y: -1.5)
        }
      }
      .padding(.top, entry.dateLabel.isEmpty ? 0 : WT.innerGap)

      SectionHeader(title: "묵상 질문", color: textColor, fontSize: CGFloat(entry.design.text.size) * WT.bannerIndexSizeRatio)
        .padding(.top, WT.sectionGap)
        .widgetTextShadow(onPhoto: onPhoto)

      Rectangle()
        .fill(dividerColor(onPhoto: onPhoto))
        .frame(height: 1)
        .padding(.top, WT.innerGap)

      if hasQuestions {
        VStack(alignment: .leading, spacing: 6) {
          ForEach(Array(meditationLines.prefix(6).enumerated()), id: \.offset) { idx, line in
            HStack(alignment: .top, spacing: 2) {
              Text(idx == 0 ? "•" : "")
                .font(.system(size: CGFloat(entry.design.text.size), weight: .semibold))
                .foregroundColor(textColor)
                .frame(width: 18, alignment: .leading)
              Text(line)
                .font(.system(size: CGFloat(entry.design.text.size), weight: contentFontWeight(entry.design.text.weight)))
                .foregroundColor(textColor)
                .multilineTextAlignment(textAlignment(entry.design.text.align))
                .lineLimit(2)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: frameAlignment(entry.design.text.align))
            }
            .widgetTextShadow(onPhoto: onPhoto)
          }
        }
        .padding(.top, WT.sectionGap)
      } else {
        Text(noQuestionsText)
          .font(.system(size: CGFloat(entry.design.text.size)))
          .foregroundColor(textColor.opacity(0.6))
          .padding(.top, WT.sectionGap)
          .widgetTextShadow(onPhoto: onPhoto)
      }

      Spacer(minLength: 0)
    }
    .padding(EdgeInsets(top: WT.outerPad, leading: 10, bottom: WT.outerPad, trailing: 10))
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }

  // Medium
  private var mediumContent: some View {
    VStack(alignment: .leading, spacing: WT.innerGap) {
      HStack(alignment: .center) {
        SectionHeader(title: "묵상 질문", color: textColor, fontSize: CGFloat(entry.design.text.size) * WT.cardIndexSizeRatio)
        Spacer(minLength: 6)
        Text(entry.mergedTitle)
          .font(.system(size: CGFloat(entry.design.text.size) * WT.cardIndexSizeRatio, weight: .bold))
          .foregroundColor(textColor)
          .lineLimit(1)
        if entry.youtubeLinkEnabled {
          Spacer(minLength: 4)
          YoutubeMarkerView()
        }
      }
      .padding(.horizontal, WT.outerPad)
      .padding(.top, WT.outerPad)
      .widgetTextShadow(onPhoto: onPhoto)

      Rectangle()
        .fill(dividerColor(onPhoto: onPhoto))
        .frame(height: 1)
        .padding(.horizontal, WT.outerPad)

      if hasQuestions {
        VStack(alignment: .leading, spacing: 5) {
          ForEach(Array(meditationLines.prefix(4).enumerated()), id: \.offset) { idx, line in
            HStack(alignment: .top, spacing: 2) {
              Text(idx == 0 ? "•" : "")
                .font(.system(size: CGFloat(entry.design.text.size), weight: .semibold))
                .foregroundColor(textColor)
                .frame(width: 16, alignment: .leading)
              Text(line)
                .font(.system(size: CGFloat(entry.design.text.size), weight: contentFontWeight(entry.design.text.weight)))
                .foregroundColor(textColor)
                .multilineTextAlignment(textAlignment(entry.design.text.align))
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: frameAlignment(entry.design.text.align))
            }
            .widgetTextShadow(onPhoto: onPhoto)
          }
        }
        .padding(.horizontal, WT.outerPad)
      } else {
        Text(noQuestionsText)
          .font(.system(size: CGFloat(entry.design.text.size)))
          .foregroundColor(textColor.opacity(0.6))
          .padding(.horizontal, WT.outerPad)
          .widgetTextShadow(onPhoto: onPhoto)
      }

      Spacer(minLength: WT.outerPad)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }
}
