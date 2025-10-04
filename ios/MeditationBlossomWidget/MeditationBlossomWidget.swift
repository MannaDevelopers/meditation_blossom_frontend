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
    let sharedDefaults = UserDefaults(suiteName: "group.mannachurch.meditationblossom")
    
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
      return SimpleEntry(date: Date(), title: sermon.title, quote: quote ?? "설교 본문을 가져오는 중 문제가 발생했습니다", verse: verse ?? " ")
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

#Preview(as: .systemMedium) {
  MeditationBlossomWidget()
} timeline: {
  SimpleEntry(date: Date(), title: " ", quote: "등록된 설교가 없습니다", verse: " ")
}
