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
  static let widgetDesignKey = "widget_design"
  static let fallbackYoutubeUrl = URL(string: "https://www.youtube.com/@만나")!
  static let widgetKind = "MeditationBlossomWidget"
  static let deepLinkSundaySermon = URL(string: "meditationblossom://open?tab=sunday_sermon")!
}

// MARK: - Widget Design

// src/types/WidgetDesign.ts와 1:1 대응하는 미러 타입. 이 위젯 익스텐션은 메인 앱 타깃(#220의
// WidgetUpdateModuleImpl)과 별개 타깃이라 그쪽 Codable 타입을 공유할 수 없다 — Sermon.swift가
// 이미 같은 이유로 JS 타입을 이 타깃 안에서 따로 미러링하는 것과 동일한 패턴.
struct WidgetImageTransform: Codable {
  let zoom: Double
  let focalX: Double
  let focalY: Double
}

struct WidgetTextDesign: Codable {
  let align: String // "left" | "center" | "right"
  let color: String
  let size: Int
  let weight: String // "regular" | "bold" | "extrabold"
}

struct WidgetBackgroundDesign: Codable {
  let type: String // "color" | "gallery"
  let value: String
  let imageTransform: WidgetImageTransform?
}

struct WidgetDesign: Codable {
  let text: WidgetTextDesign
  let background: WidgetBackgroundDesign
}

// 편집 기능 도입 전 하드코딩 스타일과 동일 — src/types/WidgetDesign.ts의 DEFAULT_WIDGET_DESIGN 참고.
private let defaultWidgetDesign = WidgetDesign(
  text: WidgetTextDesign(align: "left", color: "#000000", size: 16, weight: "regular"),
  background: WidgetBackgroundDesign(type: "color", value: "gradient-default", imageTransform: nil)
)

// MARK: - Design → SwiftUI 변환 헬퍼

// 잘못된/손상된 hex 문자열이어도 위젯 프로세스가 크래시하면 안 되므로(홈 화면 전체가 멈춤),
// 파싱 실패 시 검정으로 안전하게 폴백한다.
private func hexColor(_ hex: String) -> Color {
  var sanitized = hex.trimmingCharacters(in: .whitespacesAndNewlines)
  sanitized = sanitized.replacingOccurrences(of: "#", with: "")
  var rgb: UInt64 = 0
  guard Scanner(string: sanitized).scanHexInt64(&rgb), sanitized.count == 6 else {
    return .black
  }
  return Color(
    red: Double((rgb & 0xFF0000) >> 16) / 255,
    green: Double((rgb & 0x00FF00) >> 8) / 255,
    blue: Double(rgb & 0x0000FF) / 255
  )
}

// 본문(content)에만 적용 — 제목/장절은 실제 위젯처럼 두께 고정(src/components/WidgetPreview.tsx의
// IOSWidgetFrame과 동일한 규칙).
private func contentFontWeight(_ weight: String) -> Font.Weight {
  switch weight {
  case "bold": return .bold
  case "extrabold": return .heavy
  default: return .regular
  }
}

private func textAlignment(_ align: String) -> TextAlignment {
  switch align {
  case "center": return .center
  case "right": return .trailing
  default: return .leading
  }
}

private func frameAlignment(_ align: String) -> Alignment {
  switch align {
  case "center": return .center
  case "right": return .trailing
  default: return .leading
  }
}

// src/utils/imageCropMath.ts의 clampFocal과 동일 — 프레임이 이미지 경계를 벗어나지 않도록
// 포커스 포인트를 [halfExtent, 1-halfExtent]로 clamp한다.
private func clampFocal(_ value: Double, _ halfExtent: Double) -> Double {
  if halfExtent >= 0.5 { return 0.5 }
  return min(max(value, halfExtent), 1 - halfExtent)
}

// 사진 위에 얹힌 텍스트의 가독성을 위한 그림자 — 배경이 gallery일 때만 적용
// (src/components/WidgetPreview.tsx의 textOnPhotoShadow와 동일한 값).
private struct PhotoTextShadow: ViewModifier {
  let enabled: Bool
  func body(content: Content) -> some View {
    if enabled {
      content.shadow(color: .black.opacity(0.6), radius: 3, x: 0, y: 1)
    } else {
      content
    }
  }
}

private extension View {
  func widgetTextShadow(onPhoto: Bool) -> some View {
    modifier(PhotoTextShadow(enabled: onPhoto))
  }
}

private func dividerColor(onPhoto: Bool) -> Color {
  onPhoto ? Color.white.opacity(0.4) : Color(red: 0.10, green: 0.10, blue: 0.10).opacity(0.12)
}

// 갤러리 배경 이미지를 zoom/focalX/focalY 기준으로 cover-fit 배치한다.
// src/components/WidgetPreview.tsx의 useGalleryImageLayout/GalleryBackground와 동일한 계산 —
// 이미지를 "프레임을 빈틈없이 채우는 최소 배율(baseScale) × zoom"으로 키운 뒤, 포커스 포인트가
// 프레임 중심에 오도록 위치를 잡는다. 파일을 못 읽으면(경로가 오래돼 사라졌거나 손상된 경우)
// 회색 폴백으로 안전하게 처리한다.
private struct GalleryBackgroundView: View {
  let path: String
  let transform: WidgetImageTransform?

  var body: some View {
    GeometryReader { geo in
      if let uiImage = UIImage(contentsOfFile: path) {
        let imageSize = uiImage.size
        let baseScale = max(geo.size.width / imageSize.width, geo.size.height / imageSize.height)
        let scale = baseScale * (transform?.zoom ?? 1.0)
        let displayedWidth = imageSize.width * scale
        let displayedHeight = imageSize.height * scale

        let halfExtentX = displayedWidth > 0 ? geo.size.width / 2 / displayedWidth : 0.5
        let halfExtentY = displayedHeight > 0 ? geo.size.height / 2 / displayedHeight : 0.5
        let focalX = clampFocal(transform?.focalX ?? 0.5, halfExtentX)
        let focalY = clampFocal(transform?.focalY ?? 0.5, halfExtentY)
        let imageLeft = geo.size.width / 2 - focalX * displayedWidth
        let imageTop = geo.size.height / 2 - focalY * displayedHeight

        Image(uiImage: uiImage)
          .resizable()
          .frame(width: displayedWidth, height: displayedHeight)
          .position(x: imageLeft + displayedWidth / 2, y: imageTop + displayedHeight / 2)
      } else {
        Color.gray.opacity(0.2)
      }
    }
    .clipped()
  }
}

// background.type/value에 따라 갤러리 사진 / 저장된 단색 / (편집 전 상태와 동일한) 기존 그라데이션
// 에셋 중 하나를 그린다.
@ViewBuilder
private func designBackground(_ background: WidgetBackgroundDesign, defaultImageName: String) -> some View {
  if background.type == "gallery" {
    GalleryBackgroundView(path: background.value, transform: background.imageTransform)
  } else if background.value == "gradient-default" {
    Image(defaultImageName)
      .resizable()
      .aspectRatio(contentMode: .fill)
  } else {
    hexColor(background.value)
  }
}

struct SimpleEntry: TimelineEntry {
  let date: Date
  let title: String
  let quote: String
  let verse: String
  let videoUrl: String?
  let youtubeLinkEnabled: Bool
  let design: WidgetDesign

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
                                     verse: " ", videoUrl: nil, youtubeLinkEnabled: false, design: defaultWidgetDesign)

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
    let design = sharedDefaults.getObjectFromString(forKey: WidgetConstants.widgetDesignKey, castTo: WidgetDesign.self) ?? defaultWidgetDesign

    return SimpleEntry(date: Date(), title: sermon.title, quote: quote, verse: verse, videoUrl: sermon.videoUrl, youtubeLinkEnabled: youtubeLinkEnabled, design: design)
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

  var body: some View {
    let design = entry.design
    let onPhoto = design.background.type == "gallery"
    let textColor = hexColor(design.text.color)
    let hasVerse = !entry.verse.trimmingCharacters(in: .whitespaces).isEmpty

    Group {
      switch family {
      case .systemLarge:
        ZStack(alignment: .topLeading) {
          designBackground(design.background, defaultImageName: "background_364_382")

          VStack(alignment: .leading, spacing: 0) {
            // 제목 (2줄까지 가능 — 마커는 항상 전체 제목 높이의 중앙에 위치)
            HStack(alignment: .center) {
              Text(entry.title)
                .font(.system(size: CGFloat(design.text.size), weight: .bold))
                .foregroundColor(textColor)
                .lineLimit(2)
                .widgetTextShadow(onPhoto: onPhoto)
              Spacer(minLength: 4)
              if entry.youtubeLinkEnabled {
                YoutubeMarkerView()
              }
            }

            // 본문 참조
            if hasVerse {
              Text(entry.verse)
                .font(.system(size: CGFloat(design.text.size), weight: .semibold))
                .foregroundColor(textColor)
                .padding(.top, 6)
                .widgetTextShadow(onPhoto: onPhoto)
            }

            // 구분선
            Rectangle()
              .fill(dividerColor(onPhoto: onPhoto))
              .frame(height: 1)
              .padding(.top, 10)

            // 본문
            Text(entry.quote)
              .font(.system(size: CGFloat(design.text.size), weight: contentFontWeight(design.text.weight)))
              .foregroundColor(textColor)
              .multilineTextAlignment(textAlignment(design.text.align))
              .lineLimit(9)
              .lineSpacing(CGFloat(design.text.size) * 0.4)
              .frame(maxWidth: .infinity, alignment: frameAlignment(design.text.align))
              .padding(.top, 10)
              .widgetTextShadow(onPhoto: onPhoto)

            Spacer(minLength: 0)
          }
          .padding(EdgeInsets(top: 18, leading: 24, bottom: 18, trailing: 24))
          .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }

      case .systemMedium:
        ZStack(alignment: .topLeading) {
          designBackground(design.background, defaultImageName: "background_364_170")

          VStack(alignment: .leading, spacing: 6) {
            // 제목 + 참조 행 — QT 묵상질문 위젯과 동일하게 .center 정렬로 마커를 배치한다.
            HStack(alignment: .center) {
              Text(entry.title)
                .font(.system(size: CGFloat(design.text.size), weight: .bold))
                .foregroundColor(textColor)
                .lineLimit(1)
                .widgetTextShadow(onPhoto: onPhoto)
              if hasVerse {
                Spacer(minLength: 4)
                Text(entry.verse)
                  .font(.system(size: CGFloat(design.text.size), weight: .semibold))
                  .foregroundColor(textColor)
                  .lineLimit(1)
                  .widgetTextShadow(onPhoto: onPhoto)
              }
              if entry.youtubeLinkEnabled {
                Spacer(minLength: 4)
                YoutubeMarkerView()
              }
            }
            .padding(.horizontal, 18)
            .padding(.top, 18)

            // 구분선
            Rectangle()
              .fill(dividerColor(onPhoto: onPhoto))
              .frame(height: 1)
              .padding(.horizontal, 18)

            // 본문
            Text(entry.quote)
              .font(.system(size: CGFloat(design.text.size), weight: contentFontWeight(design.text.weight)))
              .foregroundColor(textColor)
              .multilineTextAlignment(textAlignment(design.text.align))
              .lineLimit(4)
              .lineSpacing(CGFloat(design.text.size) * 0.4)
              .frame(maxWidth: .infinity, alignment: frameAlignment(design.text.align))
              .padding(.horizontal, 18)
              .widgetTextShadow(onPhoto: onPhoto)

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
  }
}
