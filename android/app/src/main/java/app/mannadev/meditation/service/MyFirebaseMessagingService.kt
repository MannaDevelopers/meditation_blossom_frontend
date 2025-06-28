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
import kotlinx.coroutines.runBlocking
import javax.inject.Inject

@SuppressLint("MissingFirebaseInstanceTokenRefresh") //subject 를 통한 구독만 사용할 예정.
class MyFirebaseMessagingService : FirebaseMessagingService() {

    @Inject
    lateinit var saveDisplaySermonUseCase: SaveDisplaySermonUseCase

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        // sermon_events 주제에서 온 메시지인지 확인 (선택 사항, from 필드로 확인 가능)
        if (message.from == "/topics/sermon_events") {
            consumeSermonEvent(message)
        }
    }

    private fun consumeSermonEvent(message: RemoteMessage) {
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
        runBlocking {
            runCatching {
                saveDisplaySermonUseCase(sermonDto)
                AnalyticsHelper.logUpdateSermonEvent(SermonEventSource.FCM_TOPIC)
            }.onFailure { e ->
                CrashlyticsHelper.recordException(
                    exception = e,
                    message = "Failed to save sermon: $sermonDto"
                )
            }
        }
        //widget 업데이트
        runBlocking {
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

    }

    private fun messageToSermon(data: Map<String, String>): SermonDto {
        return SermonDto(
            date = data["date"]!!,
            title = data["title"]!!,
            content = data["content"]!!,
            dayOfWeek = data["day_of_week"]!!
        )
    }
}