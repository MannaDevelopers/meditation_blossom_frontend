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
import android.util.Log

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
            println("=========onSermonUpdated Launched=================")
            println("SermonData: $sermonData")
            println("Thread: ${Thread.currentThread().name}")
            println("ModuleScope: ${moduleScope}")
            
            //optional: save sermon to prefs
            runCatching {
                Log.d("WidgetUpdateModule", "Saving sermon to prefs...")
                val getSaveSermonUseCase = moduleDependencies.getSaveDisplaySermonUseCase()
                val sermonDto = json.decodeFromString<SermonDto>(sermonData)
                Log.d("WidgetUpdateModule", "SermonDto: $sermonDto")
                getSaveSermonUseCase(sermonDto)
                AnalyticsHelper.logUpdateSermonEvent(SermonEventSource.RN_MODULE)
                Log.d("WidgetUpdateModule", "Sermon saved to prefs successfully")
            }.onFailure { error ->
                Log.e("WidgetUpdateModule", "Failed to save sermon to prefs: ${error.message}")
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
                // println("Sermon data saved to AsyncStorage equivalent: $sermonData")
                Log.d("WidgetUpdateModule", "Sermon data saved to AsyncStorage equivalent: $sermonData")
            }.onFailure { error ->
                // println("Failed to save sermon data to AsyncStorage: ${error.message}")
                Log.d("WidgetUpdateModule", "Failed to save sermon data to AsyncStorage: ${error.message}")
            }

            try {
                val context = reactApplicationContext
                
                Log.d("WidgetUpdateModule", "Waiting for data to be fully saved...")
                Thread.sleep(500) // 데이터 저장 완료 대기
                
                Log.d("WidgetUpdateModule", "Updating widgets...")
                // 위젯 강제 업데이트
                VerseWidgetLarge().updateAll(context)
                VerseWidgetSmall().updateAll(context)
                
                Log.d("WidgetUpdateModule", "First widget update completed, waiting...")
                Thread.sleep(200) // 위젯 업데이트 완료 대기
                
                // 위젯이 즉시 새 데이터를 사용하도록 강제 새로고침
                Log.d("WidgetUpdateModule", "Second widget update...")
                VerseWidgetLarge().updateAll(context)
                VerseWidgetSmall().updateAll(context)
                
                Log.d("WidgetUpdateModule", "All widget updates completed successfully")
                Log.d("WidgetUpdateModule", "context: $context")
                promise.resolve(true)
            } catch (e: Exception) {
                Log.e("WidgetUpdateModule", "Widget update failed: ${e.message}")
                promise.reject("WIDGET_UPDATE_ERROR", e.message, e)
            }
        }

}