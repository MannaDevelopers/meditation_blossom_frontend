package app.mannadev.meditation.rnmodule

import android.content.Context
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.Arguments
import timber.log.Timber

class FCMCheckModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "FCMCheckModule"
    }

    @ReactMethod
    fun checkFCMReceived(promise: Promise) {
        try {
            val sharedPrefs = reactApplicationContext.getSharedPreferences("fcm_prefs", Context.MODE_PRIVATE)
            val fcmReceived = sharedPrefs.getBoolean("fcm_received", false)
            val fcmTimestamp = sharedPrefs.getLong("fcm_timestamp", 0)
            
            Timber.d("=== CHECKING FCM RECEIVED FLAG ===")
            Timber.d("FCM received: $fcmReceived")
            Timber.d("FCM timestamp: $fcmTimestamp")
            
            val result: WritableMap = Arguments.createMap()
            result.putBoolean("fcmReceived", fcmReceived)
            result.putDouble("fcmTimestamp", fcmTimestamp.toDouble())
            
            // 플래그 확인 후 초기화 (한 번만 사용)
            if (fcmReceived) {
                sharedPrefs.edit()
                    .putBoolean("fcm_received", false)
                    .apply()
                Timber.d("FCM flag cleared after check")
            }
            
            promise.resolve(result)
        } catch (e: Exception) {
            Timber.e("Error checking FCM received: ${e.message}")
            promise.reject("FCM_CHECK_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun getLatestSermonFromNative(promise: Promise) {
        try {
            val sharedPrefs = reactApplicationContext.getSharedPreferences("rn_storage", Context.MODE_PRIVATE)
            val sermonData = sharedPrefs.getString("latest_sermon_from_native", null)
            
            Timber.d("=== GETTING LATEST SERMON FROM NATIVE ===")
            Timber.d("Sermon data: $sermonData")
            
            val result: WritableMap = Arguments.createMap()
            result.putString("sermonData", sermonData)
            result.putBoolean("hasData", sermonData != null)
            
            promise.resolve(result)
        } catch (e: Exception) {
            Timber.e("Error getting latest sermon from native: ${e.message}")
            promise.reject("SERMON_GET_ERROR", e.message, e)
        }
    }
} 