//
//  MeditationBlossomWidgetBundle.swift
//  MeditationBlossomWidget
//
//  Created by 최상준 on 5/31/25.
//

import WidgetKit
import SwiftUI

@main
struct MeditationBlossomWidgetBundle: WidgetBundle {
    var body: some Widget {
        MeditationBlossomWidget()
        // MeditationBlossomWidgetControl() - iOS 18.0+ 전용 기능이므로 주석 처리
        MeditationBlossomWidgetLiveActivity()
    }
}
