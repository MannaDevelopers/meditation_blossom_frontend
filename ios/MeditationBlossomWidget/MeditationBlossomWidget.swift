//
//  MeditationBlossomWidget.swift
//  MeditationBlossomWidget
//
//  Created by 최상준 on 5/31/25.
//

import WidgetKit
import SwiftUI
import Foundation
import RegexBuilder
import os.log

private enum WidgetConstants {
  static let appGroupId = "group.mannachurch.meditationblossom"
  static let displaySermonKey = "displaySermon"
  static let fcmSermonKey = "fcm_sermon"
  static let youtubeLinkEnabledKey = "youtube_link_enabled"
  static let fallbackYoutubeUrl = URL(string: "https://www.youtube.com/@만나")!
  static let widgetKind = "MeditationBlossomWidget"
  static let deepLinkSundaySermon = URL(string: "meditationblossom://open?tab=sunday_sermon")!
}

struct SimpleEntry: TimelineEntry {
  let date: Date
  let title: String
  let quote: String
  let verse: String
  let videoUrl: String?
  let youtubeLinkEnabled: Bool

  var targetURL: URL {
    if youtubeLinkEnabled {
      if let urlStr = videoUrl, let url = URL(string: urlStr) {
        return url
      }
      return WidgetConstants.fallbackYoutubeUrl
    }
    return WidgetConstants.deepLinkSundaySermon
  }
}

private let emptyEntry = SimpleEntry(date: Date(), title: "말씀 위젯 설치 완료!",
                                     quote: "묵상만개 앱을 한 번 실행해서 위젯을 활성화 해주세요. 말씀이 자동으로 업데이트 됩니다.",
                                     verse: " ", videoUrl: nil, youtubeLinkEnabled: false)

@available(iOS 16.0, *)
struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> SimpleEntry {
    emptyEntry
  }

  func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> ()) {
    completion(createSermonEntry())
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<SimpleEntry>) -> ()) {
    let entry = createSermonEntry()
    let nextUpdateDate = Date().addingTimeInterval(24 * 60 * 60)
    let timeline = Timeline(entries: [entry], policy: .after(nextUpdateDate))
    completion(timeline)
  }

  private func createSermonEntry() -> SimpleEntry {
    guard let sharedDefaults = UserDefaults(suiteName: WidgetConstants.appGroupId) else {
      NSLog("Widget: Failed to access App Group UserDefaults")
      return emptyEntry
    }

    // displaySermon을 먼저 확인, 없으면 fcm_sermon 확인
    var sermon: Sermon? = sharedDefaults.getObjectFromString(forKey: WidgetConstants.displaySermonKey, castTo: Sermon.self)

    if sermon == nil {
      sermon = sharedDefaults.getObjectFromString(forKey: WidgetConstants.fcmSermonKey, castTo: Sermon.self)

      if sermon != nil, let jsonString = sharedDefaults.string(forKey: WidgetConstants.fcmSermonKey) {
        // fcm_sermon을 displaySermon에도 복사 (일관성 유지)
        sharedDefaults.set(jsonString, forKey: WidgetConstants.displaySermonKey)
        sharedDefaults.synchronize()
      }
    }

    guard let sermon = sermon else {
      return emptyEntry
    }

    NSLog("Widget: Found sermon - %@ (ID: %@)", sermon.title, sermon.id)

    var verse: String = " "
    var quote: String = "설교 본문을 가져오는 중 문제가 발생했습니다"

    // Android와 동일한 파싱 로직
    // 1. 책 이름과 장:절 추출 (예: "본문 : 로마서 13:11-14")
    // 책 이름 토큰은 \S+로 매칭 — "요한1서"처럼 이름에 숫자가 포함된 경우
    // [^\d\s]+(숫자 제외)로는 "1" 앞에서 끊겨 "서 4:1"처럼 잘못 파싱되는 문제가 있어 수정함
    let bookNamePattern = #"(본문\s*[:：]?\s*)?(\S+ ?\d+:\d+(?:-\d+)?(?:,\s*\S+ ?\d+:\d+(?:-\d+)?)*)"#

    if let bookNameRegex = try? NSRegularExpression(pattern: bookNamePattern, options: []),
       let match = bookNameRegex.firstMatch(in: sermon.content, options: [], range: NSRange(sermon.content.startIndex..., in: sermon.content)) {

      // 책 이름 추출
      if let bookNameRange = Range(match.range(at: 2), in: sermon.content) {
        verse = String(sermon.content[bookNameRange]).trimmingCharacters(in: .whitespaces)
      }

      // 본문 내용 추출 (책 이름 이후의 텍스트)
      let contentStartIndex = sermon.content.index(sermon.content.startIndex, offsetBy: match.range.location + match.range.length)
      let contentAfterBookName = String(sermon.content[contentStartIndex...]).trimmingCharacters(in: .whitespacesAndNewlines)

      if !contentAfterBookName.isEmpty {
        // 구절 번호로 분리 (예: "11 텍스트 12 텍스트" -> ["텍스트", "텍스트"])
        let versePattern = #"\d+"#
        if let verseRegex = try? NSRegularExpression(pattern: versePattern, options: []) {
          let verses = verseRegex.matches(in: contentAfterBookName, options: [], range: NSRange(contentAfterBookName.startIndex..., in: contentAfterBookName))

          if !verses.isEmpty {
            // 모든 구절 추출
            var verseTexts: [String] = []

            for i in 0..<verses.count {
              let currentMatch = verses[i]

              if let currentVerseRange = Range(currentMatch.range, in: contentAfterBookName) {
                let currentVerseEndIndex = contentAfterBookName.index(currentVerseRange.upperBound, offsetBy: 0)

                var verseText: String

                if i < verses.count - 1, let nextVerseRange = Range(verses[i + 1].range, in: contentAfterBookName) {
                  // 다음 구절이 있으면 현재 구절 번호 다음부터 다음 구절 번호 전까지
                  let nextVerseStartIndex = nextVerseRange.lowerBound
                  verseText = String(contentAfterBookName[currentVerseEndIndex..<nextVerseStartIndex]).trimmingCharacters(in: .whitespacesAndNewlines)
                } else {
                  // 마지막 구절이면 구절 번호 다음부터 끝까지
                  verseText = String(contentAfterBookName[currentVerseEndIndex...]).trimmingCharacters(in: .whitespacesAndNewlines)
                }

                // 구절 번호와 텍스트를 함께 저장
                let verseNumber = String(contentAfterBookName[currentVerseRange]).trimmingCharacters(in: .whitespacesAndNewlines)
                verseTexts.append("\(verseNumber) \(verseText)")
              }
            }

            // 모든 구절을 합쳐서 반환
            quote = verseTexts.joined(separator: "\n\n")
          } else {
            // 구절 번호가 없으면 전체 텍스트 사용
            quote = contentAfterBookName
          }
        }
      }
    }

    let youtubeLinkEnabled = sharedDefaults.bool(forKey: WidgetConstants.youtubeLinkEnabledKey)

    return SimpleEntry(date: Date(), title: sermon.title, quote: quote, verse: verse, videoUrl: sermon.videoUrl, youtubeLinkEnabled: youtubeLinkEnabled)
  }
}


struct MeditationBlossomWidget: Widget {
  let kind: String = WidgetConstants.widgetKind

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: Provider()) { entry in
      if #available(iOS 17.0, *) {
        MeditationBlossomWidgetEntryView(entry: entry)
          .containerBackground(.fill.tertiary, for: .widget)
          .widgetURL(entry.targetURL)
      } else {
        // iOS 16에서는 View 자체에 배경 적용
        MeditationBlossomWidgetEntryView(entry: entry)
          .widgetURL(entry.targetURL)
      }
    }
    .configurationDisplayName("주일 말씀")
    .description("이번 주 말씀을 홈 화면에서 바로 확인하세요.")
    .supportedFamilies([.systemMedium, .systemLarge])
  }
}

struct MeditationBlossomWidgetEntryView : View {
  var entry: SimpleEntry
  @Environment(\.widgetFamily) var family

  // 매일만나 위젯과 통일된 색상 토큰
  private let primaryText = Color(red: 0.10, green: 0.10, blue: 0.10)
  private let secondaryText = Color(red: 0.10, green: 0.10, blue: 0.10).opacity(0.50)
  private let accentText = Color(red: 0.18, green: 0.42, blue: 0.25)
  private let dividerColor = Color(red: 0.10, green: 0.10, blue: 0.10).opacity(0.12)

  var body: some View {
    Group {
      switch family {
      case .systemLarge:
        ZStack(alignment: .topLeading) {
          Image("background_364_382")
            .resizable()
            .aspectRatio(contentMode: .fill)

          VStack(alignment: .leading, spacing: 0) {
            // 제목 (2줄까지 가능 — 마커는 항상 전체 제목 높이의 중앙에 위치)
            HStack(alignment: .center) {
              Text(entry.title)
                .font(.system(size: 18, weight: .bold))
                .foregroundColor(primaryText)
                .lineLimit(2)
              Spacer(minLength: 4)
              if entry.youtubeLinkEnabled {
                YoutubeMarkerView()
              }
            }

            // 본문 참조
            if !entry.verse.trimmingCharacters(in: .whitespaces).isEmpty {
              Text(entry.verse)
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(accentText)
                .padding(.top, 6)
            }

            // 구분선
            Rectangle()
              .fill(dividerColor)
              .frame(height: 1)
              .padding(.top, 10)

            // 본문
            Text(entry.quote)
              .font(.system(size: 15))
              .foregroundColor(primaryText)
              .lineLimit(9)
              .lineSpacing(2)
              .padding(.top, 10)

            Spacer(minLength: 0)
          }
          .padding(EdgeInsets(top: 18, leading: 24, bottom: 18, trailing: 24))
          .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }

      case .systemMedium:
        ZStack(alignment: .topLeading) {
          Image("background_364_170")
            .resizable()
            .aspectRatio(contentMode: .fill)

          VStack(alignment: .leading, spacing: 6) {
            // 제목 + 참조 행
            HStack(alignment: .firstTextBaseline) {
              Text(entry.title)
                .font(.system(size: 14, weight: .bold))
                .foregroundColor(primaryText)
                .lineLimit(1)
              if !entry.verse.trimmingCharacters(in: .whitespaces).isEmpty {
                Spacer(minLength: 4)
                Text(entry.verse)
                  .font(.system(size: 12, weight: .semibold))
                  .foregroundColor(accentText)
                  .lineLimit(1)
              }
              if entry.youtubeLinkEnabled {
                Spacer(minLength: 4)
                // firstTextBaseline 정렬 행에서 텍스트가 아닌 마커는 살짝 아래로
                // 치우쳐 보여서(폰트 메트릭 특성상), 수동으로 위로 보정한다.
                YoutubeMarkerView()
                  .offset(y: -1.5)
              }
            }
            .padding(.horizontal, 18)
            .padding(.top, 18)

            // 구분선
            Rectangle()
              .fill(dividerColor)
              .frame(height: 1)
              .padding(.horizontal, 18)

            // 본문
            Text(entry.quote)
              .font(.system(size: 14))
              .foregroundColor(primaryText)
              .lineLimit(4)
              .lineSpacing(1.5)
              .padding(.horizontal, 18)

            Spacer(minLength: 18)
          }
          .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }

      default:
        ZStack {
          Color.clear
        }
      }
    }
    .widgetBackground(Color.clear)
  }
}

// iOS 16 호환을 위한 커스텀 modifier
extension View {
  func widgetBackground(_ color: Color) -> some View {
    if #available(iOS 17.0, *) {
      return AnyView(self.containerBackground(for: .widget) {
        color
      })
    } else {
      return AnyView(self.background(color))
    }
  }
}
