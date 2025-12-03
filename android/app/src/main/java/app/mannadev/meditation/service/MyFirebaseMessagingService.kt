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
        Timber.d("=== FCM MESSAGE RECEIVED (onMessageReceived) ===")
        Timber.d("From: ${message.from}")
        Timber.d("Data keys: ${message.data.keys.joinToString(", ")}")
        Timber.d("Data size: ${message.data.size}")
        Timber.d("Notification: ${message.notification}")
        Timber.d("MessageId: ${message.messageId}")
        Timber.d("SentTime: ${message.sentTime}")
        
        // 각 데이터 필드 개별 출력 (인코딩 문제 방지)
        message.data.forEach { (key, value) ->
            Timber.d("  Data[$key] = ${value.take(100)}") // 처음 100자만 출력
        }

        // sermon_events 또는 sermon_events_test 주제에서 온 메시지인지 확인
        // 1. message.from 필드 확인 (토픽 메시지의 경우 "/topics/토픽이름" 형식)
        // 2. data 필드의 topic 확인 (iOS와 동일한 방식)
        val isSermonEventsTopic = message.from == TOPIC_SERMON_EVENTS
        val isTestTopic = if (BuildConfig.DEBUG) {
            message.from == TOPIC_SERMON_EVENTS_TEST
        } else {
            false
        }
        
        // data 필드의 topic 확인 (message.from이 정확하지 않을 수 있음)
        val topicFromData = message.data[KEY_TOPIC]
        val isSermonEventsFromData = topicFromData == "sermon_events"
        val isTestTopicFromData = if (BuildConfig.DEBUG) {
            topicFromData == "sermon_events_test"
        } else {
            false
        }
        
        // from 필드에 sermon_events가 포함되어 있는지 확인 (fallback)
        val isSermonEventsFromContains = message.from?.contains("sermon_events") == true
        
        Timber.d("Topic check results:")
        Timber.d("  isSermonEventsTopic: $isSermonEventsTopic")
        Timber.d("  isTestTopic: $isTestTopic")
        Timber.d("  topicFromData: $topicFromData")
        Timber.d("  isSermonEventsFromData: $isSermonEventsFromData")
        Timber.d("  isTestTopicFromData: $isTestTopicFromData")
        Timber.d("  isSermonEventsFromContains: $isSermonEventsFromContains")
        
        val shouldProcess = isSermonEventsTopic || isTestTopic || 
                           isSermonEventsFromData || isTestTopicFromData ||
                           isSermonEventsFromContains

        Timber.d("shouldProcess: $shouldProcess")

        if (shouldProcess) {
            val topicName = when {
                isTestTopic || isTestTopicFromData -> "sermon_events_test"
                else -> "sermon_events"
            }
            Timber.d("Processing $topicName message")
            Timber.d("Launching consumeSermonEvent coroutine...")
            
            // 각 메시지마다 독립적인 scope 생성 (다른 메시지의 취소에 영향받지 않음)
            val messageScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
            messageScope.launch {
                try {
                    consumeSermonEvent(message)
                } finally {
                    // 작업 완료 후 scope 정리
                    messageScope.cancel()
                }
            }
            Timber.d("Coroutine launched with independent scope")
        } else {
            Timber.d("Message not from sermon_events topic, ignoring")
            Timber.d("From: ${message.from}, Topic from data: $topicFromData")
            Timber.d("All data keys: ${message.data.keys.joinToString(", ")}")
        }
        Timber.d("=== onMessageReceived END ===")
    }

    private suspend fun consumeSermonEvent(message: RemoteMessage) {
        Timber.d("=== CONSUMING SERMON EVENT ===")
        Timber.d("Message data: ${message.data}")
        Timber.d("Message data size: ${message.data.size}")

        if (message.data.isEmpty()) {
            Timber.e("❌ Message data is empty, returning")
            return
        }

        // 필수 필드 확인
        val hasDate = message.data.containsKey(KEY_DATE)
        val hasTitle = message.data.containsKey(KEY_TITLE)
        val hasContent = message.data.containsKey(KEY_CONTENT)
        val hasDayOfWeek = message.data.containsKey(KEY_DAY_OF_WEEK)
        
        Timber.d("Required fields check:")
        Timber.d("  date: $hasDate (${message.data[KEY_DATE]})")
        Timber.d("  title: $hasTitle (${message.data[KEY_TITLE]?.take(50)}...)")
        Timber.d("  content: $hasContent (${message.data[KEY_CONTENT]?.take(50)}...)")
        Timber.d("  day_of_week: $hasDayOfWeek (${message.data[KEY_DAY_OF_WEEK]})")

        val sermonDto =
            runCatching { messageToSermon(message.data) }
                .onFailure { e ->
                    Timber.e("❌ Failed to parse sermon data: ${message.data}, error: ${e.message}")
                    Timber.e("   Exception: ${e.javaClass.simpleName}")
                    e.printStackTrace()
                    CrashlyticsHelper.recordException(
                        exception = e,
                        message = "Failed to parse sermon data: ${message.data}",
                    )
                }.getOrNull() ?: run {
                    Timber.e("❌ Failed to parse sermon DTO, returning")
                    return
                }

        Timber.d("✅ Parsed sermon DTO: $sermonDto")

        // 1. Sermon 저장 (가장 중요 - 취소 불가능한 컨텍스트에서 처리)
        runCatching {
            Timber.d("💾 Saving sermon to local storage...")
            // NonCancellable 컨텍스트에서 실행하여 취소 방지
            withContext(NonCancellable) {
                saveDisplaySermonUseCase(sermonDto)
                AnalyticsHelper.logUpdateSermonEvent(SermonEventSource.FCM_TOPIC)
            }
            Timber.d("✅ Sermon saved successfully to local storage")
        }.onFailure { e ->
            Timber.e("❌ Failed to save sermon: $sermonDto, error: ${e.message}")
            Timber.e("   Exception type: ${e.javaClass.simpleName}")
            if (e is kotlinx.coroutines.CancellationException) {
                Timber.e("   ⚠️ Job was cancelled - this may be due to concurrent message processing")
            }
            e.printStackTrace()
            CrashlyticsHelper.recordException(
                exception = e,
                message = "Failed to save sermon: $sermonDto",
            )
        }

        // 2. 위젯 업데이트 (독립적으로 처리 - 실패해도 계속 진행)
        runCatching {
            Timber.d("🔄 Updating widgets...")
            VerseWidgetLarge().updateAll(applicationContext)
            VerseWidgetSmall().updateAll(applicationContext)
            Timber.d("✅ Widgets updated successfully")
        }.onFailure { e ->
            Timber.e("❌ Failed to update widgets, error: ${e.message}")
            Timber.e("   Exception type: ${e.javaClass.simpleName}")
            if (e is kotlinx.coroutines.CancellationException) {
                Timber.e("   ⚠️ Widget update was cancelled - continuing with other tasks")
            }
            e.printStackTrace()
            CrashlyticsHelper.recordException(
                exception = e,
                message = "Failed to update widgets",
            )
        }

        // 3. AsyncStorage 업데이트 및 Broadcast (독립적으로 처리)
        runCatching {
            Timber.d("💾 Updating AsyncStorage...")
            withContext(Dispatchers.IO) {
                asyncStorage.set(key = ASYNC_STORAGE_FCM_SERMON, value = Json.encodeToString(message.data))
            }
            Timber.d("✅ AsyncStorage updated successfully")
            
            Timber.d("📢 Sending broadcast: $ACTION_SERMON_UPDATE_EVENT")
            LocalBroadcastManager
                .getInstance(this@MyFirebaseMessagingService)
                .sendBroadcast(
                    Intent(ACTION_SERMON_UPDATE_EVENT)
                )
            Timber.d("✅ Broadcast sent successfully")
        }.onFailure { e ->
            Timber.e("❌ Failed to update AsyncStorage or send broadcast, error: ${e.message}")
            Timber.e("   Exception type: ${e.javaClass.simpleName}")
            if (e is kotlinx.coroutines.CancellationException) {
                Timber.e("   ⚠️ AsyncStorage update was cancelled - continuing")
            }
            e.printStackTrace()
            CrashlyticsHelper.recordException(
                exception = e,
                message = "Failed to asyncStorage",
            )
        }
        
        Timber.d("✅ === SERMON EVENT CONSUMED SUCCESSFULLY ===")
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
