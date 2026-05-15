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

    fun logWidgetUpdated(widgetType: String) {
        Firebase.analytics.logEvent("widget_updated") {
            param("widget_type", widgetType)
        }
    }

    fun logWidgetInstalled(widgetType: String) {
        Firebase.analytics.logEvent("widget_installed") {
            param("widget_type", widgetType)
        }
    }

    fun logWidgetRemoved(widgetType: String) {
        Firebase.analytics.logEvent("widget_removed") {
            param("widget_type", widgetType)
        }
    }
}

enum class SermonEventSource(val value: String) {
    FCM_TOPIC("fcm_topic"),
    FIRESTORE("firestore"),
    RN_MODULE("rn_module"),
    RN_ASYNCSTORAGE("rn_asyncstorage"),
}