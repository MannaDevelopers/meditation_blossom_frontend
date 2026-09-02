package app.mannadev.meditation.rnmodule

import android.net.Uri
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
import java.io.File
import java.io.FileOutputStream
import java.util.UUID

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
                log.d("Saving sermon widget design to prefs...")
                val designDto = json.decodeFromString<WidgetDesignDto>(designData)
                val persisted = moduleDependencies.sermonWidgetDesignRepository().save(designDto)
                log.d("Sermon widget design saved to prefs successfully")
                persisted
            }.onFailure { e ->
                CrashlyticsHelper.recordException(
                    e,
                    "Error saving sermon widget design data: ${e.message}",
                    tag = TAG
                )
            }

            saveResult
                // RN이 피커의 임시 캐시 경로 대신 영구 저장 경로를 캐싱하도록 반환값을 그대로 돌려준다.
                .onSuccess { persisted -> promise.resolve(json.encodeToString(persisted)) }
                .onFailure { e ->
                    promise.reject("WIDGET_DESIGN_UPDATE_ERROR", e.message, e)
                }
        }
    }

    override fun onQtWidgetDesignUpdated(designData: String, promise: Promise) {
        moduleScope.launch {
            val saveResult = runCatching {
                log.d("Saving QT widget design to prefs...")
                val designDto = json.decodeFromString<WidgetDesignDto>(designData)
                val persisted = moduleDependencies.qtWidgetDesignRepository().save(designDto)
                log.d("QT widget design saved to prefs successfully")
                persisted
            }.onFailure { e ->
                CrashlyticsHelper.recordException(
                    e,
                    "Error saving QT widget design data: ${e.message}",
                    tag = TAG
                )
            }

            saveResult
                .onSuccess { persisted -> promise.resolve(json.encodeToString(persisted)) }
                .onFailure { e ->
                    promise.reject("QT_WIDGET_DESIGN_UPDATE_ERROR", e.message, e)
                }
        }
    }

    // 사진 피커가 만드는 파일은 휘발성 캐시/임시 디렉토리에 있을 수 있어([#252]) 앱이 직접
    // 관리하는 cacheDir로 즉시 복사하고, 그 경로를 돌려준다 — "최근 이미지" 목록/이후 저장
    // 시점까지 안전하게 참조할 수 있게 한다. content://, file:// 둘 다 처리하기 위해
    // ContentResolver를 통해 읽는다.
    override fun persistPickedImage(sourceUri: String, promise: Promise) {
        moduleScope.launch {
            val result = runCatching {
                val resolver = reactApplicationContext.contentResolver
                val parsedUri = Uri.parse(sourceUri)
                val extension = sourceUri.substringAfterLast('.', "jpg").substringBefore('?')
                val destFile = File(reactApplicationContext.cacheDir, "picked_image_${UUID.randomUUID()}.$extension")
                val inputStream = resolver.openInputStream(parsedUri)
                    ?: throw IllegalStateException("Cannot open input stream for $sourceUri")
                inputStream.use { input ->
                    FileOutputStream(destFile).use { output -> input.copyTo(output) }
                }
                Uri.fromFile(destFile).toString()
            }.onFailure { e ->
                CrashlyticsHelper.recordException(
                    e,
                    "Error persisting picked image: ${e.message}",
                    tag = TAG
                )
            }

            result
                .onSuccess { uri -> promise.resolve(uri) }
                .onFailure { e ->
                    promise.reject("PERSIST_PICKED_IMAGE_ERROR", e.message, e)
                }
        }
    }

    // "최근 이미지" 목록에서 밀려난 사진의 persistPickedImage 캐시 파일을 정리한다([#253]).
    override fun deletePersistedImage(path: String, promise: Promise) {
        moduleScope.launch {
            val result = runCatching {
                val filePath = Uri.parse(path).path ?: path
                File(filePath).delete()
            }.onFailure { e ->
                CrashlyticsHelper.recordException(
                    e,
                    "Error deleting persisted image: ${e.message}",
                    tag = TAG
                )
            }

            result
                .onSuccess { promise.resolve(null) }
                .onFailure { e ->
                    promise.reject("DELETE_PERSISTED_IMAGE_ERROR", e.message, e)
                }
        }
    }

}