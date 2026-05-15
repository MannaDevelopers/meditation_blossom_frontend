package app.mannadev.meditation.widget

import android.content.Context
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import app.mannadev.meditation.analytics.AnalyticsHelper
import app.mannadev.meditation.ui.widget.QtWidgetLarge

class QtWidgetLargeReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = QtWidgetLarge()

    override fun onEnabled(context: Context) {
        super.onEnabled(context)
        AnalyticsHelper.logWidgetInstalled("qt_large")
    }

    override fun onDisabled(context: Context) {
        super.onDisabled(context)
        AnalyticsHelper.logWidgetRemoved("qt_large")
    }
}
