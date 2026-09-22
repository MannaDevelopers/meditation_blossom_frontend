package app.mannadev.meditation.service

import android.annotation.SuppressLint
import android.content.Intent
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import app.mannadev.meditation.BuildConfig
import app.mannadev.meditation.Constants.ACTION_QT_UPDATE_EVENT
import app.mannadev.meditation.Constants.ACTION_SERMON_UPDATE_EVENT
import app.mannadev.meditation.Constants.ASYNC_STORAGE_FCM_QT
import app.mannadev.meditation.Constants.ASYNC_STORAGE_FCM_SERMON
import app.mannadev.meditation.Constants.QT_SUBJECT
import app.mannadev.meditation.Constants.SERMON_SUBJECT_V2
import app.mannadev.meditation.Constants.SERMONS_V2_SUBJECT
import app.mannadev.meditation.analytics.AnalyticsHelper
import app.mannadev.meditation.analytics.CrashlyticsHelper
import app.mannadev.meditation.analytics.SermonEventSource
import app.mannadev.meditation.data.AsyncStorage
import app.mannadev.meditation.domain.repository.QtRepository
import app.mannadev.meditation.domain.repository.SermonRepository
import app.mannadev.meditation.dto.QtDto
import app.mannadev.meditation.dto.SermonDto
import app.mannadev.meditation.model.BibleReferenceResolver
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
        private const val KEY_MEDITATION_QUESTIONS = "meditation_questions"
        private const val KEY_TOPIC = "topic"

        private val ALLOWED_SERMON_TOPICS = setOf(SERMON_SUBJECT_V2, "sermon_events_v2_test")
        private val ALLOWED_QT_TOPICS = setOf(QT_SUBJECT, "qt_events_test")
        private val ALLOWED_SERMONS_V2_TOPICS = setOf(SERMONS_V2_SUBJECT, "sermons_v2_events_test")

        // sermon 관련 ACTION_SERMON_UPDATE_EVENT 브로드캐스트에 원본 FCM data를 함께 실어 보낼 때
        // 쓰는 Intent extra 키. sermons-v2는 week/worship_type을 실어 JS가 weekly_sermons 캐시를
        // 단일 문서만 patch할 수 있게 하고([#280]), 레거시 sermon_events(_v2)는 title/date/
        // bible_references 등을 실어 JS가 Firestore 재조회 없이 payload로 바로 반영할 수 있게 한다.
        const val EXTRA_SERMON_EVENT_DATA = "sermon_event_data"
    }

    @Inject lateinit var sermonRepository: SermonRepository
    @Inject lateinit var qtRepository: QtRepository
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
            topic in ALLOWED_SERMONS_V2_TOPICS -> consumeSermonsV2Event(message)
            else -> Unit // silent drop (v1 and anything unknown)
        }
    }

    /** Extracts topic name from `from` ("/topics/NAME") or `data.topic`. Returns null if neither resolves,
     *  and in DEBUG=false drops any `*_test` topic.
     *  topic 메시지: from = "/topics/NAME" → removePrefix 로 NAME 추출
     *  token 메시지: from = FCM 발신자ID(숫자) → data["topic"] 로 폴백 */
    private fun resolveTopic(message: RemoteMessage): String? {
        val from = message.from
        val candidate = if (from != null && from.startsWith("/topics/")) {
            from.removePrefix("/topics/")
        } else {
            message.data[KEY_TOPIC]
        } ?: return null
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
                sermonRepository.save(sermonDto)
                AnalyticsHelper.logUpdateSermonEvent(SermonEventSource.FCM_TOPIC)
            }
        }.onFailure { e ->
            CrashlyticsHelper.recordException(e, "Failed to save sermon v2: $sermonDto")
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
            // '전체' 옵션은 이 payload를 그대로 Sermon으로 변환해 화면에 반영한다
            // (sermonService.sermonFromLegacyEvent). Firestore 재조회 없이도 즉시 반영되도록
            // sermons-v2와 동일하게 원본 data를 실어 보낸다.
            val intent = Intent(ACTION_SERMON_UPDATE_EVENT).apply {
                putExtra(EXTRA_SERMON_EVENT_DATA, HashMap(message.data))
            }
            LocalBroadcastManager
                .getInstance(this@MyFirebaseMessagingService)
                .sendBroadcast(intent)
        }.onFailure { e ->
            CrashlyticsHelper.recordException(e, "Failed to update sermon AsyncStorage/broadcast")
        }
    }

    /**
     * sermons-v2: 한 주에 예배별(worship_type) 문서가 최대 4번 개별 발행되므로,
     * 레거시 [consumeSermonEvent]처럼 단일 슬롯([ASYNC_STORAGE_FCM_SERMON])/위젯에 바로 쓰면
     * 사용자가 선택한 예배와 무관한 마지막 메시지가 위젯을 덮어쓰게 된다.
     * worship_type 매칭과 위젯 반영은 JS(useFCMListener → sermonService.fetchLatestWeeklySermonsFromServer)가
     * Firestore 'sermons-v2'를 직접 조회해 전담하므로, 네이티브는 JS를 깨우는 역할만 한다.
     */
    private fun consumeSermonsV2Event(message: RemoteMessage) {
        val intent = Intent(ACTION_SERMON_UPDATE_EVENT)
        if (message.data.isNotEmpty()) {
            intent.putExtra(EXTRA_SERMON_EVENT_DATA, HashMap(message.data))
        }
        LocalBroadcastManager
            .getInstance(this@MyFirebaseMessagingService)
            .sendBroadcast(intent)
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
                qtRepository.save(qtDto)
            }
        }.onFailure { e ->
            CrashlyticsHelper.recordException(e, "Failed to save qt: $qtDto")
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
        val questionsJson = data[KEY_MEDITATION_QUESTIONS]
            ?: throw IllegalArgumentException("Missing 'meditation_questions' in qt")

        val content = bibleReferenceResolver.resolveBibleReferencesJson(bibleRefsJson)
        val videoUrl = data[KEY_VIDEO_URL]?.takeIf { it.isNotBlank() }
        val questions = Json.decodeFromString<List<String>>(questionsJson)

        return QtDto(
            date = date,
            title = title,
            seriesTitle = seriesTitle,
            content = content,
            dayOfWeek = dayOfWeek,
            videoUrl = videoUrl,
            meditationQuestions = questions,
        )
    }
}
