//
//  MeditationBlossomWidgetBundle.swift
//  MeditationBlossomWidget
//
//  Created by 최상준 on 4/11/25.
//

import WidgetKit
import SwiftUI

@main
struct MeditationBlossomWidgetBundle: WidgetBundle {
    var body: some Widget {
        MeditationBlossomWidget()
        MeditationBlossomWidgetControl()
        MeditationBlossomWidgetLiveActivity()
    }
}
