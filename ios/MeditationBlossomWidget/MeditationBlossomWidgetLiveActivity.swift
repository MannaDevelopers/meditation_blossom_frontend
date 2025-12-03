//
//  MeditationBlossomWidgetLiveActivity.swift
//  MeditationBlossomWidget
//
//  Created by 최상준 on 5/31/25.
//

import ActivityKit
import WidgetKit
import SwiftUI

struct MeditationBlossomWidgetAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        // Dynamic stateful properties about your activity go here!
        var emoji: String
    }

    // Fixed non-changing properties about your activity go here!
    var name: String
}

struct MeditationBlossomWidgetLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: MeditationBlossomWidgetAttributes.self) { context in
            // Lock screen/banner UI goes here
            VStack {
                Text("Hello \(context.state.emoji)")
            }
            .activityBackgroundTint(Color.cyan)
            .activitySystemActionForegroundColor(Color.black)

        } dynamicIsland: { context in
            DynamicIsland {
                // Expanded UI goes here.  Compose the expanded UI through
                // various regions, like leading/trailing/center/bottom
                DynamicIslandExpandedRegion(.leading) {
                    Text("Leading")
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text("Trailing")
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text("Bottom \(context.state.emoji)")
                    // more content
                }
            } compactLeading: {
                Text("L")
            } compactTrailing: {
                Text("T \(context.state.emoji)")
            } minimal: {
                Text(context.state.emoji)
            }
            .widgetURL(URL(string: "http://www.apple.com"))
            .keylineTint(Color.red)
        }
    }
}

extension MeditationBlossomWidgetAttributes {
    fileprivate static var preview: MeditationBlossomWidgetAttributes {
        MeditationBlossomWidgetAttributes(name: "World")
    }
}

extension MeditationBlossomWidgetAttributes.ContentState {
    fileprivate static var smiley: MeditationBlossomWidgetAttributes.ContentState {
        MeditationBlossomWidgetAttributes.ContentState(emoji: "😀")
     }
     
     fileprivate static var starEyes: MeditationBlossomWidgetAttributes.ContentState {
         MeditationBlossomWidgetAttributes.ContentState(emoji: "🤩")
     }
}

// iOS 16.6과 호환성을 위해 Preview 주석 처리
/*
#Preview("Notification", as: .content, using: MeditationBlossomWidgetAttributes.preview) {
   MeditationBlossomWidgetLiveActivity()
} contentStates: {
    MeditationBlossomWidgetAttributes.ContentState.smiley
    MeditationBlossomWidgetAttributes.ContentState.starEyes
}
*/
