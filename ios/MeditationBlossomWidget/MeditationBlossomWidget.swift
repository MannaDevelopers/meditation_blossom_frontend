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
    // 미리보기나 빠른 뷰용 스냅샷 생성
    // 실제 위젯 데이터를 읽어서 표시
    let entry = createSermonEntry()
    NSLog("📸 Widget: getSnapshot called - Context.isPreview: %@", context.isPreview ? "YES" : "NO")
    print("📸 Widget: getSnapshot called - Context.isPreview: \(context.isPreview)")
    completion(entry)
  }
  
  func getTimeline(in context: Context, completion: @escaping (Timeline<SimpleEntry>) -> ()) {
    // NSLog는 Console.app에서 더 잘 보임
    NSLog("🔄 Widget: getTimeline called (WidgetKit push or system refresh)")
    NSLog("🔄 Widget: Context.isPreview = %@", context.isPreview ? "YES" : "NO")
    NSLog("🔄 Widget: Checking App Group data...")
    // print도 유지 (Xcode 콘솔용)
    print("🔄 Widget: getTimeline called (WidgetKit push or system refresh)")
    print("🔄 Widget: Context.isPreview = \(context.isPreview)")
    print("🔄 Widget: Checking App Group data...")
    
    let entry = createSermonEntry()
    
    // WidgetKit Push를 받은 경우 iOS 시스템이 자동으로 위젯의 getTimeline을 호출함
    // WidgetKit Push payload의 reloadTimelines가 위젯을 즉시 업데이트함
    // 앱이 완전히 종료된 상태에서도 WidgetKit Push로 위젯이 즉시 업데이트됨
    // 
    // 중요: 위젯 예산이 소진되지 않도록 업데이트 빈도를 최소화함
    // .never는 WidgetKit Push의 reloadTimelines도 제한할 수 있으므로 사용하지 않음
    // .after(Date().addingTimeInterval(24 * 60 * 60))는 24시간 후에만 자동 업데이트를 요청하므로
    // 위젯 예산이 거의 소진되지 않음 (일일 예산 75.00, 하루에 1회만 자동 업데이트)
    // WidgetKit Push는 reloadTimelines를 통해 직접 위젯을 업데이트하므로
    // .after로 설정해도 WidgetKit Push는 정상 작동함
    // 위젯 예산: 75.00/일, 위젯 업데이트마다 1.0씩 차감됨
    // 예산이 음수가 되면 IndividualBalance == -1이 되어 WidgetRefreshPolicy가 차단함
    // 24시간 간격으로 설정하면 자동 업데이트로 인한 예산 소진을 최소화할 수 있음
    let nextUpdateDate = Date().addingTimeInterval(24 * 60 * 60) // 24시간 후 재시도 (예산 보존)
    let timeline = Timeline(entries: [entry], policy: .after(nextUpdateDate))
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
    NSLog("🔄 Widget: createSermonEntry called")
    print("🔄 Widget: createSermonEntry called")
    
    guard let sharedDefaults = UserDefaults(suiteName: "group.mannachurch.meditationblossom") else {
      NSLog("❌ Widget: Failed to access App Group UserDefaults")
      print("❌ Widget: Failed to access App Group UserDefaults")
      return SimpleEntry(date: Date(), title: " ", quote: "등록된 설교가 없습니다", verse: " ")
    }
    
    NSLog("✅ Widget: App Group UserDefaults accessed successfully")
    print("✅ Widget: App Group UserDefaults accessed successfully")
    
    // App Group에 저장된 모든 키 확인
    let allKeys = sharedDefaults.dictionaryRepresentation().keys
    print("🔄 Widget: All keys in App Group: \(Array(allKeys).sorted())")
    
    // displaySermon과 fcm_sermon 존재 여부 확인
    let displaySermonExists = sharedDefaults.string(forKey: "displaySermon") != nil
    let fcmSermonExists = sharedDefaults.string(forKey: "fcm_sermon") != nil
    NSLog("🔄 Widget: Key existence check:")
    NSLog("   - displaySermon exists: %@", displaySermonExists ? "YES" : "NO")
    NSLog("   - fcm_sermon exists: %@", fcmSermonExists ? "YES" : "NO")
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
    NSLog("🔄 Widget: Attempting to read displaySermon...")
    print("🔄 Widget: Attempting to read displaySermon...")
    var sermon: Sermon? = sharedDefaults.getObjectFromString(forKey: "displaySermon", castTo: Sermon.self)
    
    if sermon == nil {
      NSLog("⚠️ Widget: displaySermon not found or failed to parse, checking fcm_sermon...")
      print("⚠️ Widget: displaySermon not found or failed to parse, checking fcm_sermon...")
      NSLog("🔄 Widget: Attempting to read fcm_sermon...")
      print("🔄 Widget: Attempting to read fcm_sermon...")
      sermon = sharedDefaults.getObjectFromString(forKey: "fcm_sermon", castTo: Sermon.self)
      
      if let sermon = sermon {
        NSLog("✅ Widget: Found sermon data in fcm_sermon - %@ (ID: %@)", sermon.title, sermon.id)
        print("✅ Widget: Found sermon data in fcm_sermon - \(sermon.title) (ID: \(sermon.id))")
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
      NSLog("✅ Widget: Successfully read displaySermon")
      print("✅ Widget: Successfully read displaySermon")
    }
    
    if let sermon = sermon {
      NSLog("✅ Widget: Found sermon data - %@ (ID: %@, Date: %@)", sermon.title, sermon.id, sermon.date)
      NSLog("   - Content length: %lu characters", sermon.content.count)
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
