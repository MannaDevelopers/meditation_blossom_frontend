package app.mannadev.meditation.service

import android.annotation.SuppressLint
import android.content.Intent
import androidx.glance.appwidget.updateAll
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import app.mannadev.meditation.Constants.ACTION_SERMON_UPDATE_EVENT
import app.mannadev.meditation.Constants.ASYNC_STORAGE_FCM_SERMON
import app.mannadev.meditation.analytics.AnalyticsHelper
import app.mannadev.meditation.analytics.CrashlyticsHelper
import app.mannadev.meditation.analytics.SermonEventSource
import app.mannadev.meditation.data.AsyncStorage
import app.mannadev.meditation.domain.usecase.SaveDisplaySermonUseCase
import app.mannadev.meditation.dto.SermonDto
import app.mannadev.meditation.ui.widget.VerseWidgetLarge
import app.mannadev.meditation.ui.widget.VerseWidgetSmall
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.NonCancellable
import kotlinx.serialization.json.Json
import timber.log.Timber
import javax.inject.Inject
import app.mannadev.meditation.BuildConfig

@SuppressLint("MissingFirebaseInstanceTokenRefresh") // subject 를 통한 구독만 사용할 예정.
@AndroidEntryPoint
class MyFirebaseMessagingService : FirebaseMessagingService() {
    companion object {
        private const val TOPIC_SERMON_EVENTS = "/topics/sermon_events"
        private const val TOPIC_SERMON_EVENTS_TEST = "/topics/sermon_events_test"
        private const val KEY_DATE = "date"
        private const val KEY_TITLE = "title"
        private const val KEY_CONTENT = "content"
        private const val KEY_DAY_OF_WEEK = "day_of_week"
        private const val KEY_TOPIC = "topic"
    }

    @Inject
    lateinit var saveDisplaySermonUseCase: SaveDisplaySermonUseCase

    @Inject
    lateinit var asyncStorage: AsyncStorage

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    override fun onDestroy() {
        super.onDestroy()
        serviceScope.cancel()
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        Timber.d("FCM message received from: ${message.from}, keys: ${message.data.keys}")

        if (!shouldProcess(message)) {
            Timber.d("Message not from sermon_events topic, ignoring")
            return
        }

        Timber.d("Processing sermon_events message")
        serviceScope.launch {
            consumeSermonEvent(message)
        }
    }

    private fun shouldProcess(message: RemoteMessage): Boolean {
        val from = message.from
        val topicFromData = message.data[KEY_TOPIC]

        val isSermonEventsTopic = from == TOPIC_SERMON_EVENTS
        val isTestTopic = BuildConfig.DEBUG && (from == TOPIC_SERMON_EVENTS_TEST || topicFromData == "sermon_events_test")
        val isSermonEventsFromData = topicFromData == "sermon_events"
        val isSermonEventsFromContains = from?.contains("sermon_events") == true

        return isSermonEventsTopic || isTestTopic || isSermonEventsFromData || isSermonEventsFromContains
    }

    private suspend fun consumeSermonEvent(message: RemoteMessage) {
        if (message.data.isEmpty()) {
            Timber.e("Message data is empty")
            return
        }

        val sermonDto =
            runCatching { messageToSermon(message.data) }
                .onFailure { e ->
                    Timber.e(e, "Failed to parse sermon data")
                    CrashlyticsHelper.recordException(
                        exception = e,
                        message = "Failed to parse sermon data: ${message.data}",
                    )
                }.getOrNull() ?: return

        Timber.d("Parsed sermon: ${sermonDto.title}")

        // 1. Sermon 저장 (가장 중요 - 취소 불가능한 컨텍스트에서 처리)
        runCatching {
            withContext(NonCancellable) {
                saveDisplaySermonUseCase(sermonDto)
                AnalyticsHelper.logUpdateSermonEvent(SermonEventSource.FCM_TOPIC)
            }
        }.onFailure { e ->
            Timber.e(e, "Failed to save sermon")
            CrashlyticsHelper.recordException(
                exception = e,
                message = "Failed to save sermon: $sermonDto",
            )
        }

        // 2. 위젯 업데이트
        runCatching {
            VerseWidgetLarge().updateAll(applicationContext)
            VerseWidgetSmall().updateAll(applicationContext)
        }.onFailure { e ->
            Timber.e(e, "Failed to update widgets")
            CrashlyticsHelper.recordException(
                exception = e,
                message = "Failed to update widgets",
            )
        }

        // 3. AsyncStorage 업데이트 및 Broadcast
        runCatching {
            withContext(Dispatchers.IO) {
                asyncStorage.set(key = ASYNC_STORAGE_FCM_SERMON, value = Json.encodeToString(message.data))
            }
            LocalBroadcastManager
                .getInstance(this@MyFirebaseMessagingService)
                .sendBroadcast(Intent(ACTION_SERMON_UPDATE_EVENT))
        }.onFailure { e ->
            Timber.e(e, "Failed to update AsyncStorage or send broadcast")
            CrashlyticsHelper.recordException(
                exception = e,
                message = "Failed to update AsyncStorage or send broadcast",
            )
        }
    }

    private fun messageToSermon(data: Map<String, String>): SermonDto {
        val date = data[KEY_DATE] ?: throw IllegalArgumentException("Missing 'date' in sermon data")
        val title =
            data[KEY_TITLE] ?: throw IllegalArgumentException("Missing 'title' in sermon data")
        val content =
            data[KEY_CONTENT] ?: throw IllegalArgumentException("Missing 'content' in sermon data")
        val dayOfWeek =
            data[KEY_DAY_OF_WEEK]
                ?: throw IllegalArgumentException("Missing 'day_of_week' in sermon data")

        return SermonDto(
            date = date,
            title = title,
            content = content,
            dayOfWeek = dayOfWeek,
        )
    }
}
