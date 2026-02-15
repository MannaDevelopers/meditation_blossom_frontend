package app.mannadev.meditation.analytics

import com.google.firebase.crashlytics.FirebaseCrashlytics
import timber.log.Timber

object CrashlyticsHelper {
    fun recordException(exception: Throwable, message: String? = null, tag: String? = null) {
        Timber
            .tag(tag ?: "CrashlyticsHelper")
            .e(exception, "Recording exception: $message")
        val crashlytics = FirebaseCrashlytics.getInstance()
        if (message != null) {
            crashlytics.log(message)
        }
        crashlytics.recordException(exception)
    }
}