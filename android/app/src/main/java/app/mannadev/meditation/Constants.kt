package app.mannadev.meditation

object Constants {
    const val SERMON_SUBJECT = "sermon_events" // For unsubscription
    const val SERMON_SUBJECT_V2 = "sermon_events_v2"
    const val QT_SUBJECT = "qt_events"

    const val ACTION_SERMON_UPDATE_EVENT = "app.mannadev.meditation.SERMON_UPDATE_EVENT"
    const val MESSAGE_SERMON_UPDATE_EVENT = "ON_SERMON_UPDATE"

    const val ACTION_QT_UPDATE_EVENT = "app.mannadev.meditation.QT_UPDATE_EVENT"
    const val MESSAGE_QT_UPDATE_EVENT = "ON_QT_UPDATE"

    const val ASYNC_STORAGE_FCM_SERMON = "fcm_sermon"
    const val ASYNC_STORAGE_FCM_QT = "fcm_qt"

    const val FALLBACK_YOUTUBE_URL = "https://www.youtube.com/@만나"

    const val DEEP_LINK_SUNDAY_SERMON = "meditationblossom://open?tab=sunday_sermon"
    const val DEEP_LINK_DAILY_MANNA = "meditationblossom://open?tab=daily_manna"
}
