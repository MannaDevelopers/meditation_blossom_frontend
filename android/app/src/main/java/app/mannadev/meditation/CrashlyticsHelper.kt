package app.mannadev.meditation

import android.util.Log
import com.google.firebase.crashlytics.FirebaseCrashlytics

object CrashlyticsHelper {
    fun recordException(exception: Throwable, message: String? = null) {
        Log.e("CrashlyticsHelper", "Recording exception: $message", exception)
        if (message != null) {
            FirebaseCrashlytics.getInstance().recordException(RuntimeException(message, exception))
        } else {
            FirebaseCrashlytics.getInstance().recordException(exception)
        }
    }
}