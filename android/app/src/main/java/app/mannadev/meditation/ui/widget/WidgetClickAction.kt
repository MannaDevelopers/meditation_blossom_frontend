package app.mannadev.meditation.ui.widget

import androidx.glance.action.Action
import androidx.glance.appwidget.action.actionRunCallback

fun widgetClickAction(videoUrl: String?): Action =
    actionRunCallback<YoutubeLinkClickAction>(YoutubeLinkClickAction.params(videoUrl))
