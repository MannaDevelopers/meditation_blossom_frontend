package app.mannadev.meditation.service

import android.annotation.SuppressLint
import androidx.glance.appwidget.updateAll
import app.mannadev.meditation.analytics.AnalyticsHelper
import app.mannadev.meditation.analytics.CrashlyticsHelper
import app.mannadev.meditation.analytics.SermonEventSource
import app.mannadev.meditation.dto.SermonDto
import app.mannadev.meditation.ui.widget.VerseWidgetLarge
import app.mannadev.meditation.ui.widget.VerseWidgetSmall
import app.mannadev.meditation.usecase.SaveDisplaySermonUseCase
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import timber.log.Timber
import javax.inject.Inject

@SuppressLint("MissingFirebaseInstanceTokenRefresh") //subject 를 통한 구독만 사용할 예정.
@AndroidEntryPoint
class MyFirebaseMessagingService : FirebaseMessagingService() {

    companion object {
        private const val TOPIC_SERMON_EVENTS = "/topics/sermon_events"
        private const val KEY_DATE = "date"
        private const val KEY_TITLE = "title"
        private const val KEY_CONTENT = "content"
        private const val KEY_DAY_OF_WEEK = "day_of_week"
    }

    @Inject
    lateinit var saveDisplaySermonUseCase: SaveDisplaySermonUseCase

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onDestroy() {
        super.onDestroy()
        serviceScope.cancel()
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        Timber.d("onMessageReceived: ${message.from}")
        // sermon_events 주제에서 온 메시지인지 확인 (선택 사항, from 필드로 확인 가능)
        if (message.from == TOPIC_SERMON_EVENTS) {
            serviceScope.launch {
                consumeSermonEvent(message)
            }
        }
    }

    private suspend fun consumeSermonEvent(message: RemoteMessage) {
        if (message.data.isEmpty()) return
        val sermonDto = runCatching { messageToSermon(message.data) }
            .onFailure { e ->
                CrashlyticsHelper.recordException(
                    exception = e,
                    message = "Failed to parse sermon data: ${message.data}"
                )
            }
            .getOrNull() ?: return
        // 여기서 sermon 객체를 사용하여 필요한 작업을 수행
        runCatching {
            Timber.d(sermonDto.toString())
            saveDisplaySermonUseCase(sermonDto)
            AnalyticsHelper.logUpdateSermonEvent(SermonEventSource.FCM_TOPIC)
        }.onFailure { e ->
            CrashlyticsHelper.recordException(
                exception = e,
                message = "Failed to save sermon: $sermonDto"
            )
        }
        //widget 업데이트
        runCatching {
            VerseWidgetLarge().updateAll(applicationContext)
            VerseWidgetSmall().updateAll(applicationContext)
        }.onFailure { e ->
            CrashlyticsHelper.recordException(
                exception = e,
                message = "Failed to update widgets after sermon update"
            )
        }

    }

    private fun messageToSermon(data: Map<String, String>): SermonDto {
        val date = data[KEY_DATE] ?: throw IllegalArgumentException("Missing 'date' in sermon data")
        val title = data[KEY_TITLE] ?: throw IllegalArgumentException("Missing 'title' in sermon data")
        val content = data[KEY_CONTENT] ?: throw IllegalArgumentException("Missing 'content' in sermon data")
        val dayOfWeek = data[KEY_DAY_OF_WEEK] ?: throw IllegalArgumentException("Missing 'day_of_week' in sermon data")

        return SermonDto(
            date = date,
            title = title,
            content = content,
            dayOfWeek = dayOfWeek
        )
    }
}