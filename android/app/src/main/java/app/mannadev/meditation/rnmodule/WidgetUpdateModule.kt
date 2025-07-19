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
    fun onSermonUpdated(sermonData: String, promise: Promise) =
        moduleScope.launch {
            //optional: save sermon to prefs
            runCatching {
                val getSaveSermonUseCase = moduleDependencies.getSaveDisplaySermonUseCase()
                getSaveSermonUseCase(json.decodeFromString<SermonDto>(sermonData))
                AnalyticsHelper.logUpdateSermonEvent(SermonEventSource.RN_MODULE)
            }.onFailure { error ->
                CrashlyticsHelper.recordException(
                    error,
                    "Error saving sermon data: ${error.localizedMessage}"
                )
            }

            // AsyncStorage에 설교 데이터 저장 (React Native에서 접근 가능)
            runCatching {
                val sharedPrefs = reactApplicationContext.getSharedPreferences("rn_storage", android.content.Context.MODE_PRIVATE)
                sharedPrefs.edit()
                    .putString("latest_sermon_from_native", sermonData)
                    .apply()
                println("Sermon data saved to AsyncStorage equivalent: $sermonData")
            }.onFailure { error ->
                println("Failed to save sermon data to AsyncStorage: ${error.message}")
            }

            try {
                val context = reactApplicationContext

                // 위젯 강제 업데이트
                VerseWidgetLarge().updateAll(context)
                VerseWidgetSmall().updateAll(context)
                
                // 위젯이 즉시 새 데이터를 사용하도록 강제 새로고침
                Thread.sleep(100) // 잠시 대기
                VerseWidgetLarge().updateAll(context)
                VerseWidgetSmall().updateAll(context)

                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("WIDGET_UPDATE_ERROR", e.message, e)
            }
        }

}