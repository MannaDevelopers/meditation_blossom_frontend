package app.mannadev.meditation.analytics

import com.google.firebase.analytics.ktx.analytics
import com.google.firebase.analytics.logEvent
import com.google.firebase.ktx.Firebase

object AnalyticsHelper {
    fun logUpdateSermonEvent(source: SermonEventSource) {
        Firebase.analytics.logEvent("sermon_updated") {
            param("source", source.value)
        }
    }
}

enum class SermonEventSource(val value: String) {
    FCM_TOPIC("fcm_topic"),
    FIRESTORE("firestore"),
    RN_MODULE("rn_module"),
    RN_ASYNCSTORAGE("rn_asyncstorage"),
}