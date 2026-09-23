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
import app.mannadev.meditation.data.WeeklySermons
import app.mannadev.meditation.data.WorshipSetting
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
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
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

        // 한 주에 예배별 sermons-v2가 연달아(최대 4건) 오면 각 이벤트가 serviceScope에서 병렬로
        // weekly_sermons를 read-modify-write 하므로, 직렬화하지 않으면 서로의 patch를 덮어써 잃는다.
        // 서비스 인스턴스가 재생성돼도 공유되도록 companion에 둔다.
        private val weeklySermonsMutex = Mutex()
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
            topic in ALLOWED_SERMONS_V2_TOPICS -> serviceScope.launch { consumeSermonsV2Event(message) }
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

        // 레거시 sermon_events(_v2)는 '전체' 옵션 전용 콘텐츠다. 특정 예배시간을 선택한 사용자의 위젯/
        // '지금 화면' 슬롯을 덮어쓰면 안 된다([#307]) — JS(useFCMListener)와 동일하게 '전체'일 때만 반영하고,
        // 그 외엔 legacy 전용 캐시만 갱신해 나중에 '전체'로 전환하면 바로 보이게 한다.
        // 앱이 완전히 종료된 상태에선 JS가 없어 이 판단을 네이티브가 직접 해야 한다.
        val isAllSetting = runCatching {
            withContext(Dispatchers.IO) {
                WorshipSetting.isAll(asyncStorage.get(WorshipSetting.ASYNC_STORAGE_KEY))
            }
        }.onFailure { e ->
            CrashlyticsHelper.recordException(e, "Failed to read worship setting for sermon v2")
        }.getOrDefault(false)
        Timber.d("sermon v2 isAllSetting=$isAllSetting")

        if (isAllSetting) {
            runCatching {
                withContext(NonCancellable) {
                    sermonRepository.save(sermonDto)
                    AnalyticsHelper.logUpdateSermonEvent(SermonEventSource.FCM_TOPIC)
                }
            }.onFailure { e ->
                CrashlyticsHelper.recordException(e, "Failed to save sermon v2: $sermonDto")
            }
        }

        runCatching {
            withContext(Dispatchers.IO) {
                val dataWithResolvedContent = message.data.toMutableMap().apply {
                    put(KEY_CONTENT, sermonDto.content)
                }
                asyncStorage.set(
                    key = WorshipSetting.ASYNC_STORAGE_LEGACY_SERMON_CACHE,
                    value = WorshipSetting.legacyCacheJson(dataWithResolvedContent),
                )
                if (isAllSetting) {
                    asyncStorage.set(
                        key = ASYNC_STORAGE_FCM_SERMON,
                        value = Json.encodeToString(dataWithResolvedContent),
                    )
                }
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
     * sermons-v2: 한 주에 예배별(worship_type) 문서가 최대 4번 개별 발행된다. 레거시 [consumeSermonEvent]처럼
     * 무조건 단일 슬롯/위젯에 쓰면 선택하지 않은 예배가 위젯을 덮어쓰므로 worship_type을 구분해 처리한다([#306]).
     * 앱이 완전히 종료돼 JS가 없는 상태에서도 처리가 끝나야 하므로 JS(useFCMListener)와 동일한 판단을
     * 네이티브에서 먼저 수행한다:
     * 1. weekly_sermons(AsyncStorage) 캐시에 이 문서를 병합 — '전체'/불일치여도 항상(설정 변경 시 바로 쓰도록).
     * 2. 현재 예배시간 설정과 worship_type이 일치하면('전체' 제외) 위젯 + fcm_sermon 슬롯 즉시 갱신.
     * 이후 JS가 살아 있으면 브로드캐스트를 받아 같은 병합/반영을 한 번 더 하는데, 결과가 같아 무해하다.
     */
    private suspend fun consumeSermonsV2Event(message: RemoteMessage) {
        if (message.data.isNotEmpty()) {
            runCatching {
                withContext(NonCancellable + Dispatchers.IO) { applySermonsV2Event(message.data) }
            }.onFailure { e ->
                CrashlyticsHelper.recordException(e, "Failed to apply sermons-v2 event: ${message.data}")
            }
        }

        val intent = Intent(ACTION_SERMON_UPDATE_EVENT)
        if (message.data.isNotEmpty()) {
            intent.putExtra(EXTRA_SERMON_EVENT_DATA, HashMap(message.data))
        }
        LocalBroadcastManager
            .getInstance(this@MyFirebaseMessagingService)
            .sendBroadcast(intent)
    }

    private suspend fun applySermonsV2Event(data: Map<String, String>) {
        val event = WeeklySermons.parseEvent(data) { bibleRefsJson ->
            // JS와 동일하게 해석 실패(빈 bible_references = "말씀 없는 날" 등)는 이벤트를 버리지 않고 빈 본문으로 둔다.
            runCatching { bibleReferenceResolver.resolveBibleReferencesJson(bibleRefsJson) }
                .onFailure { e ->
                    Timber.w(e, "sermons-v2: failed to resolve bible_references")
                    CrashlyticsHelper.recordException(e, "sermons-v2: failed to resolve bible_references")
                }
                .getOrDefault("")
        } ?: return // week/worship_type 없음 → patch 불가, JS 폴백에 맡긴다

        val shouldApply = weeklySermonsMutex.withLock {
            val merged = WeeklySermons.merge(
                existingJson = asyncStorage.get(WeeklySermons.ASYNC_STORAGE_WEEKLY_SERMONS),
                event = event,
            )
            asyncStorage.set(key = WeeklySermons.ASYNC_STORAGE_WEEKLY_SERMONS, value = merged)
            WeeklySermons.shouldApplyToWidget(
                storedSetting = asyncStorage.get(WorshipSetting.ASYNC_STORAGE_KEY),
                worshipType = event.worshipType,
            )
        }
        Timber.d("sermons-v2 ${event.week}/${event.worshipType} cached, applyToWidget=$shouldApply")
        if (!shouldApply) return

        sermonRepository.save(event.dto)
        AnalyticsHelper.logUpdateSermonEvent(SermonEventSource.FCM_TOPIC)
        // JS의 saveSermonToAsyncStorage(patched)와 동일 — 앱 실행 시 '지금 화면' 슬롯도 최신이 되도록.
        asyncStorage.set(key = ASYNC_STORAGE_FCM_SERMON, value = event.cacheEntry.toString())
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
