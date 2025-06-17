//
//  MeditationBlossomWidget.swift
//  MeditationBlossomWidget
//
//  Created by 최상준 on 5/31/25.
//

import WidgetKit
import SwiftUI

struct SimpleEntry: TimelineEntry {
  let date: Date;
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> SimpleEntry {
        SimpleEntry(date: Date())
    }

    func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> ()) {
        completion(SimpleEntry(date: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SimpleEntry>) -> ()) {
        let currentDate = Date()
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: currentDate)!
        let entry = SimpleEntry(date: currentDate)
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }
}


struct MeditationBlossomWidget: Widget {
    let kind: String = "MeditationBlossomWidget"

  var body: some WidgetConfiguration {
          StaticConfiguration(kind: "MyWidget", provider: Provider()) { entry in
            MeditationBlossomWidgetEntryView(entry: entry)
              .containerBackground(.fill.tertiary, for: .widget)
          }
        .supportedFamilies([.systemSmall, .systemMedium])
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
          Text("4.그리스도를 본받아")
            .font(.system(size:20, weight: .bold))
            .padding(.top)
            .padding(.leading)
          
          Spacer().frame(height: 20)
          
          Text("11 그가 어떤 사람은 사도로, 어떤 사람은 선지자로, 어떤 사람은 복음 전하는 자로, 어떤 사람은 목사와 교사로 삼으셨으니")
            .font(.system(size:18, weight: .bold))
            .padding(.leading)
            .padding(.trailing)
          
          Spacer().frame(height: 20)
          
          Text("마태복음 13:33")
            .font(.system(size:16))
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
    SimpleEntry(date: .now)
    SimpleEntry(date: .now)
}
