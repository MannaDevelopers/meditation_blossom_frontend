package app.mannadev.meditation.rnmodule

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import app.mannadev.meditation.Constants.ACTION_SERMON_UPDATE_EVENT
import app.mannadev.meditation.Constants.MESSAGE_SERMON_UPDATE_EVENT
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.WritableMap
import com.facebook.react.common.LifecycleState
import com.facebook.react.modules.core.DeviceEventManagerModule
import timber.log.Timber

class NativeEventModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "MyEventModule"
    override fun initialize() {
        super.initialize()
        val intentFilter = IntentFilter(ACTION_SERMON_UPDATE_EVENT)
        LocalBroadcastManager.getInstance(reactApplicationContext)
            .registerReceiver(myEventReceiver, intentFilter)
    }

    override fun invalidate() {
        super.invalidate()
        LocalBroadcastManager.getInstance(reactApplicationContext)
            .unregisterReceiver(myEventReceiver)
    }

    private val myEventReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            Timber.d("Received broadcast: ${intent?.action}")
            sendEventToJS(MESSAGE_SERMON_UPDATE_EVENT)
        }
    }

    fun sendEventToJS(eventName: String, params: WritableMap? = null) {
        if (reactApplicationContext.lifecycleState != LifecycleState.RESUMED) return
        try {
            reactApplicationContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)
        } catch (e: Exception) {
            Timber.e(e, "Failed to send event to JS: $eventName")
        }
    }

}