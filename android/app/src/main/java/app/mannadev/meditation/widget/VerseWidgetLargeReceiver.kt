package app.mannadev.meditation.widget

import android.appwidget.AppWidgetManager
import android.content.Context
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import app.mannadev.meditation.analytics.AnalyticsHelper
import app.mannadev.meditation.ui.widget.VerseWidgetLarge

class VerseWidgetLargeReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = VerseWidgetLarge()

    override fun onEnabled(context: Context) {
        super.onEnabled(context)
        AnalyticsHelper.logWidgetInstalled("verse_large")
        enqueueWidgetInitialSync(context)
    }

    // 30분 주기(updatePeriodMillis)로 시스템이 여기로 다시 진입한다 — 그 시점에 예배시간
    // 경계 재확인도 같이 실행한다([ISSUE-315]).
    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        super.onUpdate(context, appWidgetManager, appWidgetIds)
        enqueueWorshipBoundaryCheck(context)
    }

    override fun onDisabled(context: Context) {
        super.onDisabled(context)
        AnalyticsHelper.logWidgetRemoved("verse_large")
    }
}
