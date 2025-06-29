package app.mannadev.meditation.analytics

import com.google.firebase.crashlytics.FirebaseCrashlytics
import timber.log.Timber

object CrashlyticsHelper {
    fun recordException(exception: Throwable, message: String? = null) {
        Timber.Forest.e(exception, "Recording exception: $message")
        if (message != null) {
            FirebaseCrashlytics.getInstance().recordException(RuntimeException(message, exception))
        } else {
            FirebaseCrashlytics.getInstance().recordException(exception)
        }
    }
}