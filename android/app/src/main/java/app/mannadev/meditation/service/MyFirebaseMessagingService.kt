package app.mannadev.meditation.service

import android.annotation.SuppressLint
import app.mannadev.meditation.CrashlyticsHelper
import app.mannadev.meditation.dto.SermonDto
import app.mannadev.meditation.model.Sermon
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

@SuppressLint("MissingFirebaseInstanceTokenRefresh") //subject 를 통한 구독만 사용할 예정.
class MyFirebaseMessagingService : FirebaseMessagingService() {

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        // sermon_events 주제에서 온 메시지인지 확인 (선택 사항, from 필드로 확인 가능)
        if (message.from == "/topics/sermon_events") {
            consumeSermonEvent(message)
        }
    }

    private fun consumeSermonEvent(message: RemoteMessage) {
        if (message.data.isEmpty()) return
        val sermon = runCatching { messageToSermon(message.data) }
            .onFailure { e ->
                CrashlyticsHelper.recordException(
                    exception = e,
                    message = "Failed to parse sermon data: ${message.data}"
                )
            }
            .getOrNull() ?: return

        // 여기서 sermon 객체를 사용하여 필요한 작업을 수행


    }

    private fun messageToSermon(data: Map<String, String>): Sermon {
        val dto = SermonDto(
            date = data["date"] ?: "",
            title = data["title"] ?: "",
            content = data["content"] ?: "",
            dayOfWeek = data["day_of_week"] ?: ""
        )
        return Sermon.fromDto(dto)
    }
}