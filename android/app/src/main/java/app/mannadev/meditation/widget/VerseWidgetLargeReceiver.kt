package app.mannadev.meditation.widget

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

    override fun onDisabled(context: Context) {
        super.onDisabled(context)
        AnalyticsHelper.logWidgetRemoved("verse_large")
    }
}
