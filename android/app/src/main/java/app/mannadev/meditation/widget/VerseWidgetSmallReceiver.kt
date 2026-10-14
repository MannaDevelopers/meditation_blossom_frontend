package app.mannadev.meditation.widget

import android.appwidget.AppWidgetManager
import android.content.Context
import android.os.Bundle
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import app.mannadev.meditation.analytics.AnalyticsHelper
import app.mannadev.meditation.ui.widget.VerseWidgetSmall
import app.mannadev.meditation.widget.diagnostics.WidgetDiagnostics

class VerseWidgetSmallReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = VerseWidgetSmall()

    override fun onEnabled(context: Context) {
        super.onEnabled(context)
        AnalyticsHelper.logWidgetInstalled("verse_small")
        enqueueWidgetInitialSync(context)
    }

    // 30분 주기(updatePeriodMillis)로 시스템이 여기로 다시 진입한다 — 그 시점에 예배시간
    // 경계 재확인도 같이 실행한다([ISSUE-315]).
    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        WidgetDiagnostics.record(context, "ON_UPDATE", "widget" to "verse_small", "ids" to appWidgetIds.toList())
        super.onUpdate(context, appWidgetManager, appWidgetIds)
        enqueueWorshipBoundaryCheck(context)
    }

    override fun onDisabled(context: Context) {
        super.onDisabled(context)
        AnalyticsHelper.logWidgetRemoved("verse_small")
    }

    override fun onAppWidgetOptionsChanged(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        newOptions: Bundle,
    ) {
        WidgetDiagnostics.record(
            context, "OPTIONS_CHANGED",
            "widget" to "verse_small", "id" to appWidgetId, "options" to WidgetDiagnostics.optionsSummary(newOptions),
        )
        super.onAppWidgetOptionsChanged(context, appWidgetManager, appWidgetId, newOptions)
    }

    override fun onDeleted(context: Context, appWidgetIds: IntArray) {
        WidgetDiagnostics.record(context, "ON_DELETED", "widget" to "verse_small", "ids" to appWidgetIds.toList())
        super.onDeleted(context, appWidgetIds)
    }
}
