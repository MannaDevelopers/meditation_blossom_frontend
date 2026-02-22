package app.mannadev.meditation.rnmodule

import androidx.annotation.Keep
import androidx.glance.appwidget.updateAll
import app.mannadev.meditation.analytics.AnalyticsHelper
import app.mannadev.meditation.analytics.CrashlyticsHelper
import app.mannadev.meditation.analytics.SermonEventSource
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
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import timber.log.Timber

@Keep
class WidgetUpdateModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {
    companion object {
        val json: Json by lazy {
            Json {
                ignoreUnknownKeys = true
            }
        }

        private const val TAG = "WidgetUpdateModule"
        private val log = Timber.tag(TAG)
    }

    private lateinit var moduleScope: CoroutineScope

    val moduleDependencies by lazy { getRNModuleDependencies(context = reactApplicationContext) }


    override fun getName(): String = "WidgetUpdateModule"

    override fun initialize() {
        super.initialize()
        moduleScope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    }

    override fun invalidate() {
        super.invalidate()
        if (::moduleScope.isInitialized) {
            moduleScope.cancel()
        }
    }

    @Suppress("unused")
    @Keep
    @ReactMethod
    fun onClear(promise: Promise) =
        moduleScope.launch {
            //clear widget preferences
            val result = runCatching {
                log.d("Clear Widget Preferences...")
                moduleDependencies.getClearWidgetPreferences().invoke()
            }.onFailure { e ->
                CrashlyticsHelper.recordException(
                    e,
                    "Error clear Widget Preferences: ${e.message}",
                    tag = TAG
                )
            }
            runCatching { updateWidgets() }
                .onFailure {
                    CrashlyticsHelper.recordException(
                        it,
                        "Error updating widgets after clearing preferences: ${it.message}",
                        tag = TAG
                    )
                }

            result
                .onSuccess { promise.resolve(null) }
                .onFailure { e ->
                    CrashlyticsHelper.recordException(
                        e,
                        "Error in WidgetUpdateModule: ${e.message}",
                        tag = TAG
                    )
                    promise.reject("WIDGET_UPDATE_ERROR", e.message, e)
                }
        }

    @Suppress("unused")
    @Keep
    @ReactMethod
    fun onSermonUpdated(sermonData: String, promise: Promise) =
        moduleScope.launch {
            //optional: save sermon to prefs
            val saveSermonToPrefs = runCatching {
                log.d("Saving sermon to Widget Preference...")
                val saveSermonUseCase = moduleDependencies.getSaveDisplaySermonUseCase()
                val sermonDto = json.decodeFromString<SermonDto>(sermonData)
                log.d("SermonDto: $sermonDto")
                saveSermonUseCase(sermonDto)
                AnalyticsHelper.logUpdateSermonEvent(SermonEventSource.RN_MODULE)
                log.d("Sermon saved to prefs successfully")
            }.onFailure { e ->
                CrashlyticsHelper.recordException(
                    e,
                    "Error saving sermon data: ${e.message}",
                    tag = TAG
                )
            }

            runCatching { updateWidgets() }
                .onFailure {
                    CrashlyticsHelper.recordException(
                        it,
                        "Error updating widgets after saving sermon: ${it.message}",
                        tag = TAG
                    )
                }

            saveSermonToPrefs
                .onSuccess { promise.resolve(true) }
                .onFailure { e ->
                    CrashlyticsHelper.recordException(
                        e,
                        "Error in WidgetUpdateModule: ${e.message}",
                        tag = TAG
                    )
                    promise.reject("WIDGET_UPDATE_ERROR", e.message, e)
                }
        }

    private suspend fun updateWidgets() {
        val context = reactApplicationContext
        log.d("Updating widgets...")
        VerseWidgetLarge().updateAll(context)
        VerseWidgetSmall().updateAll(context)
    }

}