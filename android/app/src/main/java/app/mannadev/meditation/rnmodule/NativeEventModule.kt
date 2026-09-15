package app.mannadev.meditation.rnmodule

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import app.mannadev.meditation.Constants.ACTION_QT_UPDATE_EVENT
import app.mannadev.meditation.Constants.ACTION_SERMON_UPDATE_EVENT
import app.mannadev.meditation.Constants.MESSAGE_QT_UPDATE_EVENT
import app.mannadev.meditation.Constants.MESSAGE_SERMON_UPDATE_EVENT
import app.mannadev.meditation.analytics.CrashlyticsHelper
import app.mannadev.meditation.service.MyFirebaseMessagingService.Companion.EXTRA_SERMONS_V2_DATA
import app.mannadev.meditation.specs.NativeMyEventModuleSpec
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.common.LifecycleState
import com.facebook.react.modules.core.DeviceEventManagerModule
import timber.log.Timber

class NativeEventModule(reactContext: ReactApplicationContext) :
    NativeMyEventModuleSpec(reactContext) {

    companion object {
        const val NAME = "MyEventModule"
    }

    override fun getName() = NAME

    override fun initialize() {
        super.initialize()
        val broadcastManager = LocalBroadcastManager.getInstance(reactApplicationContext)
        broadcastManager.registerReceiver(sermonReceiver, IntentFilter(ACTION_SERMON_UPDATE_EVENT))
        broadcastManager.registerReceiver(qtReceiver, IntentFilter(ACTION_QT_UPDATE_EVENT))
    }

    override fun invalidate() {
        super.invalidate()
        val broadcastManager = LocalBroadcastManager.getInstance(reactApplicationContext)
        broadcastManager.unregisterReceiver(sermonReceiver)
        broadcastManager.unregisterReceiver(qtReceiver)
    }

    private val sermonReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            Timber.d("Received broadcast: ${intent?.action}")
            // sermons-v2 이벤트는 원본 FCM data(week/worship_type/video_url 등)를 함께 실어 보내
            // JS가 weekly_sermons 캐시를 단일 문서만 patch할 수 있게 한다([#280]).
            // 레거시 sermon_events_v2는 extra가 없으므로 그대로 params=null로 보낸다.
            @Suppress("UNCHECKED_CAST")
            val data = intent?.getSerializableExtra(EXTRA_SERMONS_V2_DATA) as? HashMap<String, String>
            if (data != null) {
                val params: WritableMap = Arguments.createMap()
                for ((k, v) in data) {
                    params.putString(k, v)
                }
                sendEventToJS(MESSAGE_SERMON_UPDATE_EVENT, params)
            } else {
                sendEventToJS(MESSAGE_SERMON_UPDATE_EVENT)
            }
        }
    }

    private val qtReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            Timber.d("Received broadcast: ${intent?.action}")
            sendEventToJS(MESSAGE_QT_UPDATE_EVENT)
        }
    }

    // NativeEventEmitter가 요구하는 메서드 (RN 0.65+)
    override fun addListener(eventName: String) {}
    override fun removeListeners(count: Double) {}

    fun sendEventToJS(eventName: String, params: WritableMap? = null) {
        if (reactApplicationContext.lifecycleState == LifecycleState.BEFORE_CREATE) return
        try {
            reactApplicationContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)
        } catch (e: Exception) {
            Timber.e(e, "Failed to send event to JS: $eventName")
            CrashlyticsHelper.recordException(e, "Failed to send event to JS: $eventName")
        }
    }
}
