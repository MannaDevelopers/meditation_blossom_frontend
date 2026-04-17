package app.mannadev.meditation.service

import android.annotation.SuppressLint
import android.content.Intent
import androidx.glance.appwidget.updateAll
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import app.mannadev.meditation.BuildConfig
import app.mannadev.meditation.Constants.ACTION_QT_UPDATE_EVENT
import app.mannadev.meditation.Constants.ACTION_SERMON_UPDATE_EVENT
import app.mannadev.meditation.Constants.ASYNC_STORAGE_FCM_QT
import app.mannadev.meditation.Constants.ASYNC_STORAGE_FCM_SERMON
import app.mannadev.meditation.Constants.QT_SUBJECT
import app.mannadev.meditation.Constants.SERMON_SUBJECT_V2
import app.mannadev.meditation.analytics.AnalyticsHelper
import app.mannadev.meditation.analytics.CrashlyticsHelper
import app.mannadev.meditation.analytics.SermonEventSource
import app.mannadev.meditation.data.AsyncStorage
import app.mannadev.meditation.domain.usecase.SaveDisplayQtUseCase
import app.mannadev.meditation.domain.usecase.SaveDisplaySermonUseCase
import app.mannadev.meditation.dto.QtDto
import app.mannadev.meditation.dto.SermonDto
import app.mannadev.meditation.model.BibleReferenceResolver
import app.mannadev.meditation.ui.widget.VerseWidgetLarge
import app.mannadev.meditation.ui.widget.VerseWidgetLargeQt
import app.mannadev.meditation.ui.widget.VerseWidgetSmall
import app.mannadev.meditation.ui.widget.VerseWidgetSmallQt
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import timber.log.Timber
import javax.inject.Inject

@SuppressLint("MissingFirebaseInstanceTokenRefresh") // topic 구독만 사용
@AndroidEntryPoint
class MyFirebaseMessagingService : FirebaseMessagingService() {

    companion object {
        private const val KEY_DATE = "date"
        private const val KEY_TITLE = "title"
        private const val KEY_SERIES_TITLE = "series_title"
        private const val KEY_CONTENT = "content"
        private const val KEY_BIBLE_REFERENCES = "bible_references"
        private const val KEY_DAY_OF_WEEK = "day_of_week"
        private const val KEY_VIDEO_URL = "video_url"
        private const val KEY_TOPIC = "topic"

        private val ALLOWED_SERMON_TOPICS = setOf(SERMON_SUBJECT_V2, "sermon_events_v2_test")
        private val ALLOWED_QT_TOPICS = setOf(QT_SUBJECT, "qt_events_test")
    }

    @Inject lateinit var saveDisplaySermonUseCase: SaveDisplaySermonUseCase
    @Inject lateinit var saveDisplayQtUseCase: SaveDisplayQtUseCase
    @Inject lateinit var asyncStorage: AsyncStorage
    @Inject lateinit var bibleReferenceResolver: BibleReferenceResolver

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    override fun onDestroy() {
        super.onDestroy()
        serviceScope.cancel()
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        val topic = resolveTopic(message) ?: return // silent drop

        when {
            topic in ALLOWED_SERMON_TOPICS -> serviceScope.launch { consumeSermonEvent(message) }
            topic in ALLOWED_QT_TOPICS -> serviceScope.launch { consumeQtEvent(message) }
            else -> Unit // silent drop (v1 and anything unknown)
        }
    }

    /** Extracts topic name from `from` ("/topics/NAME") or `data.topic`. Returns null if neither resolves,
     *  and in DEBUG=false drops any `*_test` topic. */
    private fun resolveTopic(message: RemoteMessage): String? {
        val fromTopic = message.from?.removePrefix("/topics/")
        val dataTopic = message.data[KEY_TOPIC]
        val candidate = fromTopic ?: dataTopic ?: return null
        if (!BuildConfig.DEBUG && candidate.endsWith("_test")) return null
        return candidate
    }

    private suspend fun consumeSermonEvent(message: RemoteMessage) {
        if (message.data.isEmpty()) return

        val sermonDto = runCatching { messageToSermonV2(message.data) }
            .onFailure { e ->
                CrashlyticsHelper.recordException(e, "Failed to parse sermon v2 data: ${message.data}")
            }
            .getOrNull() ?: return

        Timber.d("Parsed sermon v2: ${sermonDto.title}")

        runCatching {
            withContext(NonCancellable) {
                saveDisplaySermonUseCase(sermonDto)
                AnalyticsHelper.logUpdateSermonEvent(SermonEventSource.FCM_TOPIC)
            }
        }.onFailure { e ->
            CrashlyticsHelper.recordException(e, "Failed to save sermon v2: $sermonDto")
        }

        runCatching {
            VerseWidgetLarge().updateAll(applicationContext)
            VerseWidgetSmall().updateAll(applicationContext)
        }.onFailure { e ->
            CrashlyticsHelper.recordException(e, "Failed to update sermon widgets")
        }

        runCatching {
            withContext(Dispatchers.IO) {
                val dataWithResolvedContent = message.data.toMutableMap().apply {
                    put(KEY_CONTENT, sermonDto.content)
                }
                asyncStorage.set(
                    key = ASYNC_STORAGE_FCM_SERMON,
                    value = Json.encodeToString(dataWithResolvedContent),
                )
            }
            LocalBroadcastManager
                .getInstance(this@MyFirebaseMessagingService)
                .sendBroadcast(Intent(ACTION_SERMON_UPDATE_EVENT))
        }.onFailure { e ->
            CrashlyticsHelper.recordException(e, "Failed to update sermon AsyncStorage/broadcast")
        }
    }

    private suspend fun consumeQtEvent(message: RemoteMessage) {
        if (message.data.isEmpty()) return

        val qtDto = runCatching { messageToQt(message.data) }
            .onFailure { e ->
                CrashlyticsHelper.recordException(e, "Failed to parse qt data: ${message.data}")
            }
            .getOrNull() ?: return

        Timber.d("Parsed qt: ${qtDto.title}")

        runCatching {
            withContext(NonCancellable) {
                saveDisplayQtUseCase(qtDto)
            }
        }.onFailure { e ->
            CrashlyticsHelper.recordException(e, "Failed to save qt: $qtDto")
        }

        runCatching {
            VerseWidgetLargeQt().updateAll(applicationContext)
            VerseWidgetSmallQt().updateAll(applicationContext)
        }.onFailure { e ->
            CrashlyticsHelper.recordException(e, "Failed to update qt widgets")
        }

        runCatching {
            withContext(Dispatchers.IO) {
                val dataWithResolvedContent = message.data.toMutableMap().apply {
                    put(KEY_CONTENT, qtDto.content)
                }
                asyncStorage.set(
                    key = ASYNC_STORAGE_FCM_QT,
                    value = Json.encodeToString(dataWithResolvedContent),
                )
            }
            LocalBroadcastManager
                .getInstance(this@MyFirebaseMessagingService)
                .sendBroadcast(Intent(ACTION_QT_UPDATE_EVENT))
        }.onFailure { e ->
            CrashlyticsHelper.recordException(e, "Failed to update qt AsyncStorage/broadcast")
        }
    }

    private fun messageToSermonV2(data: Map<String, String>): SermonDto {
        val date = data[KEY_DATE] ?: throw IllegalArgumentException("Missing 'date' in sermon v2")
        val title = data[KEY_TITLE] ?: throw IllegalArgumentException("Missing 'title' in sermon v2")
        val bibleRefsJson = data[KEY_BIBLE_REFERENCES]
            ?: throw IllegalArgumentException("Missing 'bible_references' in sermon v2")
        val dayOfWeek = data[KEY_DAY_OF_WEEK]
            ?: throw IllegalArgumentException("Missing 'day_of_week' in sermon v2")

        val content = bibleReferenceResolver.resolveBibleReferencesJson(bibleRefsJson)
        val videoUrl = data[KEY_VIDEO_URL]?.takeIf { it.isNotBlank() }

        return SermonDto(
            date = date,
            title = title,
            content = content,
            dayOfWeek = dayOfWeek,
            videoUrl = videoUrl,
        )
    }

    private fun messageToQt(data: Map<String, String>): QtDto {
        val date = data[KEY_DATE] ?: throw IllegalArgumentException("Missing 'date' in qt")
        val title = data[KEY_TITLE] ?: throw IllegalArgumentException("Missing 'title' in qt")
        val seriesTitle = data[KEY_SERIES_TITLE] ?: ""
        val bibleRefsJson = data[KEY_BIBLE_REFERENCES]
            ?: throw IllegalArgumentException("Missing 'bible_references' in qt")
        val dayOfWeek = data[KEY_DAY_OF_WEEK]
            ?: throw IllegalArgumentException("Missing 'day_of_week' in qt")

        val content = bibleReferenceResolver.resolveBibleReferencesJson(bibleRefsJson)
        val videoUrl = data[KEY_VIDEO_URL]?.takeIf { it.isNotBlank() }

        return QtDto(
            date = date,
            title = title,
            seriesTitle = seriesTitle,
            content = content,
            dayOfWeek = dayOfWeek,
            videoUrl = videoUrl,
        )
    }
}
