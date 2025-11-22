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

@available(iOS 16.0, *)
struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> SimpleEntry {
    SimpleEntry(date: Date(), title: " ", quote: "등록된 설교가 없습니다", verse: " ")
  }
  
  func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> ()) {
    let entry = createSermonEntry()
    completion(entry)
  }
  
  func getTimeline(in context: Context, completion: @escaping (Timeline<SimpleEntry>) -> ()) {
    print("🔄 Widget: getTimeline called (WidgetKit push or system refresh)")
    print("🔄 Widget: Context.isPreview = \(context.isPreview)")
    print("🔄 Widget: Checking App Group data...")
    
    let entry = createSermonEntry()
    
    // 위젯킷 푸시를 받은 경우 즉시 업데이트
    // 시스템이 주기적으로 새로고침할 때도 업데이트
    let timeline = Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(60 * 60))) // 1시간 후 재시도
    completion(timeline)
  }
  
  // WidgetKit Push Notifications를 위한 메서드
  // iOS 16+에서 푸시 알림으로 위젯이 업데이트될 때 호출됨
  func reloadTimelines(ofKind kind: String, in completion: @escaping () -> Void) {
    print("🔄 Widget timeline reload requested via push notification")
    WidgetCenter.shared.reloadTimelines(ofKind: kind)
    completion()
  }
  
  private func createSermonEntry() -> SimpleEntry {
    print("🔄 Widget: createSermonEntry called")
    
    guard let sharedDefaults = UserDefaults(suiteName: "group.mannachurch.meditationblossom") else {
      print("❌ Widget: Failed to access App Group UserDefaults")
      return SimpleEntry(date: Date(), title: " ", quote: "등록된 설교가 없습니다", verse: " ")
    }
    
    print("✅ Widget: App Group UserDefaults accessed successfully")
    
    // App Group에 저장된 모든 키 확인
    let allKeys = sharedDefaults.dictionaryRepresentation().keys
    print("🔄 Widget: All keys in App Group: \(Array(allKeys).sorted())")
    
    // displaySermon과 fcm_sermon 존재 여부 확인
    let displaySermonExists = sharedDefaults.string(forKey: "displaySermon") != nil
    let fcmSermonExists = sharedDefaults.string(forKey: "fcm_sermon") != nil
    print("🔄 Widget: Key existence check:")
    print("   - displaySermon exists: \(displaySermonExists)")
    print("   - fcm_sermon exists: \(fcmSermonExists)")
    
    if let displaySermonString = sharedDefaults.string(forKey: "displaySermon") {
      print("   - displaySermon length: \(displaySermonString.count) characters")
      print("   - displaySermon preview (first 200 chars): \(String(displaySermonString.prefix(200)))")
    }
    
    if let fcmSermonString = sharedDefaults.string(forKey: "fcm_sermon") {
      print("   - fcm_sermon length: \(fcmSermonString.count) characters")
      print("   - fcm_sermon preview (first 200 chars): \(String(fcmSermonString.prefix(200)))")
    }
    
    // displaySermon을 먼저 확인, 없으면 fcm_sermon 확인
    print("🔄 Widget: Attempting to read displaySermon...")
    var sermon: Sermon? = sharedDefaults.getObjectFromString(forKey: "displaySermon", castTo: Sermon.self)
    
    if sermon == nil {
      print("⚠️ Widget: displaySermon not found or failed to parse, checking fcm_sermon...")
      print("🔄 Widget: Attempting to read fcm_sermon...")
      sermon = sharedDefaults.getObjectFromString(forKey: "fcm_sermon", castTo: Sermon.self)
      
      if let sermon = sermon {
        print("✅ Widget: Found sermon data in fcm_sermon - \(sermon.title)")
        // fcm_sermon을 displaySermon에도 복사 (일관성 유지)
        if let jsonString = sharedDefaults.string(forKey: "fcm_sermon") {
          print("📦 Widget: Copying fcm_sermon to displaySermon for consistency...")
          sharedDefaults.set(jsonString, forKey: "displaySermon")
          let syncResult = sharedDefaults.synchronize()
          print("✅ Widget: Copied fcm_sermon to displaySermon, sync result: \(syncResult)")
        }
      } else {
        print("❌ Widget: fcm_sermon also not found or failed to parse")
      }
    } else {
      print("✅ Widget: Successfully read displaySermon")
    }
    
    if let sermon = sermon {
      print("✅ Widget: Found sermon data - \(sermon.title)")
      print("   - Sermon ID: \(sermon.id)")
      print("   - Sermon date: \(sermon.date)")
      print("   - Content length: \(sermon.content.count) characters")
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
      
      print("✅ Widget: Created SimpleEntry successfully")
      return SimpleEntry(date: Date(), title: sermon.title, quote: quote, verse: verse)
    } else {
      print("❌ Widget: No sermon data found in App Group")
      print("   - This means either:")
      print("     1. No data was saved to App Group")
      print("     2. Data format is invalid")
      print("     3. JSON parsing failed")
      return SimpleEntry(date: Date(), title: " ", quote: "등록된 설교가 없습니다", verse: " ")
    }
  }
}


struct MeditationBlossomWidget: Widget {
  let kind: String = "MeditationBlossomWidget"
  
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: Provider()) { entry in
      if #available(iOS 17.0, *) {
        MeditationBlossomWidgetEntryView(entry: entry)
          .containerBackground(.fill.tertiary, for: .widget)
      } else {
        // iOS 16에서는 View 자체에 배경 적용
        MeditationBlossomWidgetEntryView(entry: entry)
      }
    }
    .supportedFamilies([.systemMedium, .systemLarge])
  }
}

struct MeditationBlossomWidgetEntryView : View {
  var entry: SimpleEntry
  @Environment(\.widgetFamily) var family
  
  var body: some View {
    Group {
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
        ZStack {
          Color.white
          Text("Error occured")
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

// iOS 16.6과 호환성을 위해 Preview 주석 처리
/*
#Preview(as: .systemMedium) {
  MeditationBlossomWidget()
} timeline: {
  SimpleEntry(date: Date(), title: " ", quote: "등록된 설교가 없습니다", verse: " ")
}
*/
