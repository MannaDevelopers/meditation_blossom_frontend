package app.mannadev.meditation.rnmodule

import androidx.annotation.Keep
import app.mannadev.meditation.analytics.AnalyticsHelper
import app.mannadev.meditation.analytics.CrashlyticsHelper
import app.mannadev.meditation.analytics.SermonEventSource
import app.mannadev.meditation.di.getRNModuleDependencies
import app.mannadev.meditation.dto.QtDto
import app.mannadev.meditation.dto.SermonDto
import app.mannadev.meditation.dto.WidgetDesignDto
import app.mannadev.meditation.specs.NativeWidgetUpdateModuleSpec
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import timber.log.Timber

@Keep
class WidgetUpdateModule(reactContext: ReactApplicationContext) :
    NativeWidgetUpdateModuleSpec(reactContext) {
    companion object {
        val json: Json by lazy {
            Json {
                ignoreUnknownKeys = true
            }
        }

        const val NAME = "WidgetUpdateModule"
        private const val TAG = "WidgetUpdateModule"
        private val log = Timber.tag(TAG)
    }

    private lateinit var moduleScope: CoroutineScope

    val moduleDependencies by lazy { getRNModuleDependencies(context = reactApplicationContext) }


    override fun getName(): String = NAME

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

    override fun onClear(promise: Promise) {
        moduleScope.launch {
            val result = runCatching {
                log.d("Clearing sermon widget preference...")
                moduleDependencies.sermonRepository().clear()
            }.onFailure { e ->
                CrashlyticsHelper.recordException(
                    e,
                    "Error clear Widget Preferences: ${e.message}",
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

    override fun onSermonUpdated(sermonData: String, promise: Promise) {
        moduleScope.launch {
            val saveSermonToPrefs = runCatching {
                log.d("Saving sermon to Widget Preference...")
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
                moduleDependencies.sermonRepository().save(resolvedDto)
                AnalyticsHelper.logUpdateSermonEvent(SermonEventSource.RN_MODULE)
                log.d("Sermon saved to prefs successfully")
            }.onFailure { e ->
                CrashlyticsHelper.recordException(
                    e,
                    "Error saving sermon data: ${e.message}",
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

    override fun resolveBibleReferences(jsonString: String, promise: Promise) {
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

    override fun getYoutubeLinkEnabled(promise: Promise) {
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

    override fun setYoutubeLinkEnabled(enabled: Boolean, promise: Promise) {
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

    // iOS 전용 (App Group 조회). Android에는 App Group 개념이 없어 항상 null.
    override fun getAppGroupData(key: String, promise: Promise) {
        promise.resolve(null)
    }

    override fun onQtUpdated(qtData: String, promise: Promise) {
        moduleScope.launch {
            val saveResult = runCatching {
                log.d("Saving QT to Widget Preference...")
                val qtDto = json.decodeFromString<QtDto>(qtData)
                moduleDependencies.qtRepository().save(qtDto)
                log.d("QT saved to prefs successfully")
            }.onFailure { e ->
                CrashlyticsHelper.recordException(e, "Error saving QT data: ${e.message}", tag = TAG)
            }

            saveResult
                .onSuccess { promise.resolve(true) }
                .onFailure { e ->
                    promise.reject("QT_UPDATE_ERROR", e.message, e)
                }
        }
    }

    override fun onWidgetDesignUpdated(designData: String, promise: Promise) {
        moduleScope.launch {
            val saveResult = runCatching {
                log.d("Saving widget design to prefs...")
                val designDto = json.decodeFromString<WidgetDesignDto>(designData)
                moduleDependencies.widgetDesignRepository().save(designDto)
                log.d("Widget design saved to prefs successfully")
            }.onFailure { e ->
                CrashlyticsHelper.recordException(
                    e,
                    "Error saving widget design data: ${e.message}",
                    tag = TAG
                )
            }

            saveResult
                .onSuccess { promise.resolve(true) }
                .onFailure { e ->
                    promise.reject("WIDGET_DESIGN_UPDATE_ERROR", e.message, e)
                }
        }
    }

}