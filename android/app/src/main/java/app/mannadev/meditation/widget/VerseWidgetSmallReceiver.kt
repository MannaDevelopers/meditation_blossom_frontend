package app.mannadev.meditation.widget

import android.content.Context
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import app.mannadev.meditation.analytics.AnalyticsHelper
import app.mannadev.meditation.ui.widget.VerseWidgetSmall

class VerseWidgetSmallReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = VerseWidgetSmall()

    override fun onEnabled(context: Context) {
        super.onEnabled(context)
        AnalyticsHelper.logWidgetInstalled("verse_small")
    }

    override fun onDisabled(context: Context) {
        super.onDisabled(context)
        AnalyticsHelper.logWidgetRemoved("verse_small")
    }
}
