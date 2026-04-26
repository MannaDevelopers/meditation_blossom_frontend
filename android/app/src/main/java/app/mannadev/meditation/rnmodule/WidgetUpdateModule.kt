package app.mannadev.meditation.rnmodule

import androidx.annotation.Keep
import androidx.glance.appwidget.updateAll
import app.mannadev.meditation.analytics.AnalyticsHelper
import app.mannadev.meditation.analytics.CrashlyticsHelper
import app.mannadev.meditation.analytics.SermonEventSource
import app.mannadev.meditation.di.getRNModuleDependencies
import app.mannadev.meditation.dto.QtDto
import app.mannadev.meditation.dto.SermonDto
import app.mannadev.meditation.ui.widget.VerseWidgetLarge
import app.mannadev.meditation.ui.widget.QtWidgetLarge
import app.mannadev.meditation.ui.widget.QtWidgetSmall
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
    fun onClear(promise: Promise) {
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
    }

    @Suppress("unused")
    @Keep
    @ReactMethod
    fun onSermonUpdated(sermonData: String, promise: Promise) {
        moduleScope.launch {
            //optional: save sermon to prefs
            val saveSermonToPrefs = runCatching {
                log.d("Saving sermon to Widget Preference...")
                val saveSermonUseCase = moduleDependencies.getSaveDisplaySermonUseCase()
                val resolver = moduleDependencies.getBibleReferenceResolver()
                val sermonDto = json.decodeFromString<SermonDto>(sermonData)
                log.d("SermonDto: $sermonDto")
                val resolvedDto = runCatching { resolver.resolveDto(sermonDto) }
                    .onFailure { e ->
                        CrashlyticsHelper.recordException(
                            e,
                            "BibleReferenceResolver failed in RN bridge: ${sermonDto.content}",
                            tag = TAG,
                        )
                    }
                    .getOrNull() ?: return@runCatching
                saveSermonUseCase(resolvedDto)
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
    }

    @Suppress("unused")
    @Keep
    @ReactMethod
    fun resolveBibleReferences(jsonString: String, promise: Promise) {
        moduleScope.launch {
            runCatching {
                val resolver = moduleDependencies.getBibleReferenceResolver()
                resolver.resolveBibleReferencesJson(jsonString)
            }
                .onSuccess { promise.resolve(it) }
                .onFailure { e ->
                    CrashlyticsHelper.recordException(
                        e,
                        "resolveBibleReferences failed for: $jsonString",
                        tag = TAG,
                    )
                    promise.reject("RESOLVE_BIBLE_REFERENCES_ERROR", e.message, e)
                }
        }
    }

    @Suppress("unused")
    @Keep
    @ReactMethod
    fun getYoutubeLinkEnabled(promise: Promise) {
        runCatching { moduleDependencies.getWidgetPrefs().isEnabled() }
            .onSuccess { promise.resolve(it) }
            .onFailure { e ->
                CrashlyticsHelper.recordException(
                    e,
                    "Error reading youtube link pref: ${e.message}",
                    tag = TAG,
                )
                promise.reject("YOUTUBE_LINK_PREF_ERROR", e.message, e)
            }
    }

    @Suppress("unused")
    @Keep
    @ReactMethod
    fun setYoutubeLinkEnabled(enabled: Boolean, promise: Promise) {
        moduleScope.launch {
            runCatching { moduleDependencies.getWidgetPrefs().setEnabled(enabled) }
                .onSuccess { promise.resolve(null) }
                .onFailure { e ->
                    CrashlyticsHelper.recordException(
                        e,
                        "Error writing youtube link pref: ${e.message}",
                        tag = TAG,
                    )
                    promise.reject("YOUTUBE_LINK_PREF_ERROR", e.message, e)
                }
        }
    }

    @Suppress("unused")
    @Keep
    @ReactMethod
    fun onQtUpdated(qtData: String, promise: Promise) {
        moduleScope.launch {
            val saveResult = runCatching {
                log.d("Saving QT to Widget Preference...")
                val saveQtUseCase = moduleDependencies.getSaveDisplayQtUseCase()
                val qtDto = json.decodeFromString<QtDto>(qtData)
                saveQtUseCase(qtDto)
                log.d("QT saved to prefs successfully")
            }.onFailure { e ->
                CrashlyticsHelper.recordException(e, "Error saving QT data: ${e.message}", tag = TAG)
            }

            runCatching { updateQtWidgets() }
                .onFailure {
                    CrashlyticsHelper.recordException(
                        it,
                        "Error updating QT widgets after saving: ${it.message}",
                        tag = TAG,
                    )
                }

            saveResult
                .onSuccess { promise.resolve(true) }
                .onFailure { e ->
                    promise.reject("QT_UPDATE_ERROR", e.message, e)
                }
        }
    }

    private suspend fun updateWidgets() {
        val context = reactApplicationContext
        log.d("Updating widgets...")
        VerseWidgetLarge().updateAll(context)
        VerseWidgetSmall().updateAll(context)
    }

    private suspend fun updateQtWidgets() {
        val context = reactApplicationContext
        log.d("Updating QT widgets...")
        QtWidgetLarge().updateAll(context)
        QtWidgetSmall().updateAll(context)
    }

}