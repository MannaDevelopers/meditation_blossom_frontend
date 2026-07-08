package app.mannadev.meditation.widget

import android.content.Context
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import app.mannadev.meditation.analytics.AnalyticsHelper
import app.mannadev.meditation.ui.widget.QtWidgetSmall

class QtWidgetSmallReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = QtWidgetSmall()

    override fun onEnabled(context: Context) {
        super.onEnabled(context)
        AnalyticsHelper.logWidgetInstalled("qt_small")
        enqueueWidgetInitialSync(context)
    }

    override fun onDisabled(context: Context) {
        super.onDisabled(context)
        AnalyticsHelper.logWidgetRemoved("qt_small")
    }
}
