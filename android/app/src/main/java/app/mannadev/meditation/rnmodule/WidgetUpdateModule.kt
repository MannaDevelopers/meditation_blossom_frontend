package app.mannadev.meditation.rnmodule

import androidx.annotation.Keep
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetManager
import app.mannadev.meditation.CrashlyticsHelper
import app.mannadev.meditation.di.getRNModuleDependencies
import app.mannadev.meditation.dto.SermonDto
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
import kotlinx.serialization.json.Json

@Keep
class WidgetUpdateModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {
    companion object {
        val json: Json by lazy {
            Json {
                ignoreUnknownKeys = true
            }
        }
    }

    private lateinit var moduleJob: Job
    private lateinit var moduleScope: CoroutineScope

    val moduleDependencies = getRNModuleDependencies(context = reactApplicationContext)


    override fun getName(): String = "WidgetUpdateModule"

    override fun initialize() {
        super.initialize()
        moduleJob = Job()
        moduleScope = CoroutineScope(Dispatchers.Main + moduleJob)
    }

    override fun invalidate() {
        super.invalidate()
        if (::moduleJob.isInitialized) {
            moduleJob.cancel()
        }
    }

    @Suppress("unused")
    @Keep
    @ReactMethod
    fun onSermonUpdated(sermonData: String, promise: Promise) =
        moduleScope.launch {
            //optional: save sermon to prefs
            runCatching {
                val getSaveSermonUseCase = moduleDependencies.getSaveDisplaySermonUseCase()
                getSaveSermonUseCase(json.decodeFromString<SermonDto>(sermonData))
            }.onFailure { error ->
                CrashlyticsHelper.recordException(
                    error,
                    "Error saving sermon data: ${error.localizedMessage}"
                )
            }

            try {
                val context = reactApplicationContext
                val glanceAppWidgetManager = GlanceAppWidgetManager(context)

                updateWidgets(
                    context,
                    glanceAppWidgetManager,
                    VerseWidgetLarge(),
                    VerseWidgetLarge::class.java
                )
                updateWidgets(
                    context,
                    glanceAppWidgetManager,
                    VerseWidgetSmall(),
                    VerseWidgetSmall::class.java
                )

                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("WIDGET_UPDATE_ERROR", e.message, e)
            }
        }

    private suspend fun <T : GlanceAppWidget> updateWidgets(
        context: ReactApplicationContext,
        glanceAppWidgetManager: GlanceAppWidgetManager,
        widget: T,
        widgetClass: Class<T>
    ) {
        // Update large widgets
        val largeWidgetIds = glanceAppWidgetManager.getGlanceIds(widgetClass)
        largeWidgetIds.forEach { glanceId ->
            widget.update(context, glanceId)
        }
    }

}