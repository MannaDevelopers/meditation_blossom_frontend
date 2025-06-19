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
    let entry = createSermonEntry()
    let nextUpdate = Calendar.current.date(byAdding: .hour, value: 1, to: Date())!
    let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
    completion(timeline)
  }
  
  private func createSermonEntry() -> SimpleEntry {
    let sharedDefaults = UserDefaults(suiteName: "group.com.Blossom.MeditationBlossom")
    
    if let sermon = sharedDefaults?.getObjectFromString(forKey: "displaySermon", castTo: Sermon.self) {
      var verse: String?
      var quote: String?
      
      let verseRegex = /([가-힣]+\s?\d+:\d+)/
      let quoteRegex = /\r\n\s*(.*)/
      
      if let match = sermon.content.firstMatch(of: verseRegex) {
          verse = String(match.output.1)
      }
      if let match = sermon.content.firstMatch(of: quoteRegex) {
          quote = String(match.output.1)
      }
      print(quote, verse)
      return SimpleEntry(date: Date(), title: sermon.title, quote: quote ?? "설교 본문을 가져오는 중 문제가 발생했습니다", verse: verse ?? " ")
    } else {
      return SimpleEntry(date: Date(), title: " ", quote: "등록된 설교가 없습니다", verse: " ")
    }
  }
}


struct MeditationBlossomWidget: Widget {
  let kind: String = "MeditationBlossomWidget"
  
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "MyWidget", provider: Provider()) { entry in
      MeditationBlossomWidgetEntryView(entry: entry)
        .containerBackground(.fill.tertiary, for: .widget)
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
            .font(.system(size:18, weight: .bold))
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
          Text("또 비유로 말씀하시되 천국은 마치 여자가 가루 서 말 속에 갖다 넣어 전부 부풀게 한 누룩과 같으니라")
            .font(.system(size:22, weight: .bold))
            .foregroundColor(.black)
            .frame(width:300, height:100)
            .offset(y:3)
          Text("마태복음 13:33")
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

#Preview(as: .systemLarge) {
  MeditationBlossomWidget()
} timeline: {
  SimpleEntry(date: Date(), title: " ", quote: "등록된 설교가 없습니다", verse: " ")
}
