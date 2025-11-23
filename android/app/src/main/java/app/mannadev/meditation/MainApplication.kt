package app.mannadev.meditation

import android.app.Application
import app.mannadev.meditation.analytics.CrashlyticsHelper
import app.mannadev.meditation.rnmodule.MyReactPackage
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint
import com.facebook.react.defaults.DefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.react.soloader.OpenSourceMergedSoMapping
import com.facebook.soloader.SoLoader
import com.google.firebase.messaging.FirebaseMessaging
import dagger.hilt.android.HiltAndroidApp
import timber.log.Timber

@HiltAndroidApp
class MainApplication : Application(), ReactApplication {

    override val reactNativeHost: ReactNativeHost =
        object : DefaultReactNativeHost(this) {
            override fun getPackages(): List<ReactPackage> =
                PackageList(this).packages.apply {
                    // Packages that cannot be autolinked yet can be added manually here, for example:
                    // add(MyReactNativePackage())
                    add(MyReactPackage())
                }

            override fun getJSMainModuleName(): String = "index"

            override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

            override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
            override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
        }

    override val reactHost: ReactHost
        get() = DefaultReactHost.getDefaultReactHost(applicationContext, reactNativeHost)

    override fun onCreate() {
        super.onCreate()
        SoLoader.init(this, OpenSourceMergedSoMapping)
        if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
            // If you opted-in for the New Architecture, we load the native entry point for this app.
            DefaultNewArchitectureEntryPoint.load()
        }
        if (BuildConfig.DEBUG) {
            Timber.plant(Timber.DebugTree())
        }

        //Subject 구독
        FirebaseMessaging.getInstance()
            .subscribeToTopic(Constants.SERMON_SUBJECT)
            .addOnCompleteListener { task ->
                task.exception?.let { exception ->
                    CrashlyticsHelper.recordException(
                        exception,
                        "FirebaseMessaging subscribeToTopic failed"
                    )
                } ?: run {
                    Timber.d("Successfully subscribed to ${Constants.SERMON_SUBJECT} topic")
                }
            }
        
        // DEBUG 모드에서만 sermon_events_test 토픽 구독 (iOS와 동일)
        if (BuildConfig.DEBUG) {
            FirebaseMessaging.getInstance()
                .subscribeToTopic("sermon_events_test")
                .addOnCompleteListener { task ->
                    task.exception?.let { exception ->
                        CrashlyticsHelper.recordException(
                            exception,
                            "FirebaseMessaging subscribeToTopic (sermon_events_test) failed"
                        )
                    } ?: run {
                        Timber.d("[DEBUG] Successfully subscribed to sermon_events_test topic")
                    }
                }
        }

    }
}