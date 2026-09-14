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
import app.mannadev.meditation.specs.NativeMyEventModuleSpec
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
            sendEventToJS(MESSAGE_SERMON_UPDATE_EVENT)
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
