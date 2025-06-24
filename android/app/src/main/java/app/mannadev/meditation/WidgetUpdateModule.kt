package app.mannadev.meditation

import androidx.annotation.Keep
import androidx.glance.appwidget.GlanceAppWidgetManager
import app.mannadev.meditation.ui.widget.VerseWidgetLarge
import app.mannadev.meditation.ui.widget.VerseWidgetSmall
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

@Keep
class WidgetUpdateModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val moduleJob = Job()
    private val moduleScope =
        CoroutineScope(Dispatchers.Main + moduleJob) // Or Dispatchers.IO for background tasks

    override fun getName(): String {
        return "WidgetUpdateModule"
    }

    @Suppress("unused")
    @Keep
    @ReactMethod
    fun onSermonUpdated(sermonData: String, promise: Promise) = moduleScope.launch {
        try {
            val context = reactApplicationContext
            val glanceAppWidgetManager = GlanceAppWidgetManager(context)

            // Update large widgets
            val largeWidgetClass = VerseWidgetLarge::class.java
            val largeWidget = VerseWidgetLarge()
            val largeWidgetIds = glanceAppWidgetManager.getGlanceIds(largeWidgetClass)
            largeWidgetIds.forEach { glanceId ->
                largeWidget.update(context, glanceId)
            }

            // Update small widgets
            val smallWidgetClass = VerseWidgetSmall::class.java
            val smallWidget = VerseWidgetSmall()
            val smallWidgetIds = glanceAppWidgetManager.getGlanceIds(smallWidgetClass)
            smallWidgetIds.forEach { glanceId ->
                smallWidget.update(context, glanceId)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("WIDGET_UPDATE_ERROR", e.message, e)
        }

    }
}