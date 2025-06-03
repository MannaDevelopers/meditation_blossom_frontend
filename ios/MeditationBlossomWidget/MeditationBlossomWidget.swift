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
    case .systemSmall:
      ZStack {
        Image("background_364_382")
          .resizable()
          .frame(width:130, height:290/3)
          .offset(y:15)
      }
    case .systemMedium:
      ZStack {
        Image("background_364_170")
          .resizable()
          .frame(width:364, height:170)
      }
    default:
      Text("Error occured")
    }
  }
}

#Preview(as: .systemSmall) {
    MeditationBlossomWidget()
} timeline: {
    SimpleEntry(date: .now)
    SimpleEntry(date: .now)
}
