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

struct SimpleEntry: TimelineEntry {
  let date: Date;
  let title: String;
  let quote: String;
  let verse: String;
}

struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> SimpleEntry {
    SimpleEntry(date: Date(), title: " ", quote: "등록된 설교가 없습니다", verse: " ")
  }
  
  func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> ()) {
    let entry = createSermonEntry()
    completion(entry)
  }
  
  func getTimeline(in context: Context, completion: @escaping (Timeline<SimpleEntry>) -> ()) {
    print("타임라인 로딩")
    let entry = createSermonEntry()
    let timeline = Timeline(entries: [entry], policy: .never)
    completion(timeline)
  }
  
  private func createSermonEntry() -> SimpleEntry {
    let sharedDefaults = UserDefaults(suiteName: "group.org.mannamethodistchurch.mannadev.meditationblossom")
    
    if let sermon = sharedDefaults?.getObjectFromString(forKey: "displaySermon", castTo: Sermon.self) {
      var verse: String = " "
      var quote: String = "설교 본문을 가져오는 중 문제가 발생했습니다"
      
      // Android와 동일한 파싱 로직
      // 1. 책 이름과 장:절 추출 (예: "본문 : 로마서 13:11-14")
      let bookNamePattern = #"(본문\s*[:：]?\s*)?([^\d\s]+ ?\d+:\d+(?:-\d+)?(?:,\s*[^\d\s]+ ?\d+:\d+(?:-\d+)?)*)"#
      
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
              // 첫 번째 구절만 추출 (위젯에 표시)
              if let firstVerseRange = Range(verses[0].range, in: contentAfterBookName) {
                let firstVerseEndIndex = contentAfterBookName.index(firstVerseRange.upperBound, offsetBy: 0)
                
                // 첫 번째 구절 번호 다음부터 두 번째 구절 번호 전까지 추출
                if verses.count > 1, let secondVerseRange = Range(verses[1].range, in: contentAfterBookName) {
                  let quoteText = String(contentAfterBookName[firstVerseEndIndex..<secondVerseRange.lowerBound])
                  quote = quoteText.trimmingCharacters(in: .whitespacesAndNewlines)
                } else {
                  // 구절이 하나만 있으면 전체 텍스트 사용
                  let quoteText = String(contentAfterBookName[firstVerseEndIndex...])
                  quote = quoteText.trimmingCharacters(in: .whitespacesAndNewlines)
                }
              }
            } else {
              // 구절 번호가 없으면 전체 텍스트 사용
              quote = contentAfterBookName
            }
          }
        }
      }
      
      return SimpleEntry(date: Date(), title: sermon.title, quote: quote, verse: verse)
    } else {
      return SimpleEntry(date: Date(), title: " ", quote: "등록된 설교가 없습니다", verse: " ")
    }
  }
}


struct MeditationBlossomWidget: Widget {
  let kind: String = "MeditationBlossomWidget"
  
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: Provider()) { entry in
      MeditationBlossomWidgetEntryView(entry: entry)
        // .containerBackground(.fill.tertiary, for: .widget) - iOS 17.0+ 기능이므로 주석 처리
    }
    .supportedFamilies([.systemMedium, .systemLarge])
  }
}

struct MeditationBlossomWidgetEntryView : View {
  var entry: SimpleEntry
  @Environment(\.widgetFamily) var family
  
  var body: some View {
    switch family {
    case .systemLarge:
      ZStack(alignment: .topLeading) {
        Image("background_364_382")
          .resizable()
          .frame(width:364, height:382)
        
        VStack (alignment: .leading) {
          Text(entry.title)
            .font(.system(size:20, weight: .bold))
            .foregroundColor(.black)
            .padding(.top)
            .padding(.leading)
          
          Spacer().frame(height: 20)
          
          Text(entry.quote)
            .font(.system(size:18, weight: .semibold))
            .foregroundColor(.black)
            .padding(.leading)
            .padding(.trailing)
          
          Spacer().frame(height: 20)
          
          Text(entry.verse)
            .font(.system(size:16))
            .foregroundColor(.black)
            .padding(.leading)
        }
        .padding(EdgeInsets(top: 30, leading: 30, bottom: 30, trailing: 30))
      }
    case .systemMedium:
      ZStack {
        Image("background_364_170")
          .resizable()
          .frame(width:364, height:170);
        VStack{
          Text(entry.quote)
            .font(.system(size:22, weight: .semibold))
            .foregroundColor(.black)
            .frame(width:300, height:100)
            .offset(y:3)
          Text(entry.verse)
            .font(.system(size:15))
            .foregroundColor(.black)
            .frame(width:180, height:20, alignment:.trailing)
            .offset(x:69)
        }
      }
    default:
      Text("Error occured")
    }
  }
}

// iOS 16.6과 호환성을 위해 Preview 주석 처리
/*
#Preview(as: .systemMedium) {
  MeditationBlossomWidget()
} timeline: {
  SimpleEntry(date: Date(), title: " ", quote: "등록된 설교가 없습니다", verse: " ")
}
*/
