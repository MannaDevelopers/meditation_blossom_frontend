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
import app.mannadev.meditation.widget.diagnostics.WidgetDiagnostics
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.runBlocking
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

        // 한 주에 예배별 sermons-v2가 연달아(최대 4건) 오면 각 이벤트가 weekly_sermons를 read-modify-write 한다.
        // [ISSUE-334] 이후 onMessageReceived 안에서 동기 처리하므로, firebase-messaging의 단일 스레드 핸들러
        // (FcmExecutors.newIntentHandleExecutor, 24.1.1 확인)가 메시지를 이미 직렬화한다. 이 mutex는 그 라이브러리
        // 내부 동작에 기대지 않기 위한 방어선이다. 서비스 인스턴스가 재생성돼도 공유되도록 companion에 둔다.
        private val weeklySermonsMutex = Mutex()
    }

    @Inject lateinit var sermonRepository: SermonRepository
    @Inject lateinit var qtRepository: QtRepository
    @Inject lateinit var asyncStorage: AsyncStorage
    @Inject lateinit var bibleReferenceResolver: BibleReferenceResolver

    // [ISSUE-334] FCM은 onMessageReceived를 백그라운드 스레드에서 호출하고, 반환하면 서비스를 종료한다.
    // 반환 후에 도는 비동기 작업은 취소·프로세스 동결에 노출되므로(Firebase 가이드) 여기서 끝까지 처리한다.
    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        val topic = resolveTopic(message) ?: return // silent drop
        val startedAt = System.currentTimeMillis()
        WidgetDiagnostics.recordWithSnapshot(
            this, "fcm_$topic", "FCM_RECEIVED",
            "topic" to topic,
            "date" to message.data[KEY_DATE],
            "priority" to message.priority,
            "originalPriority" to message.originalPriority,
            "delayMs" to (startedAt - message.sentTime),
        )

        // FCM_HANDLED는 결과와 함께 항상 남긴다(예외는 기존처럼 그대로 전파). outcome은 위젯 반영 여부를 구분한다:
        // applied(위젯 갱신) / skipped:<이유>(정상 흐름상 위젯 미반영) / failed:<단계>:<예외>(삼킨 실패).
        var outcome = "unknown"
        try {
            outcome = runBlocking {
                when {
                    topic in ALLOWED_SERMON_TOPICS -> consumeSermonEvent(message)
                    topic in ALLOWED_QT_TOPICS -> consumeQtEvent(message)
                    topic in ALLOWED_SERMONS_V2_TOPICS -> consumeSermonsV2Event(message)
                    else -> "skipped:unhandled_topic" // silent drop (v1 and anything unknown)
                }
            }
        } catch (e: Throwable) {
            outcome = "error:${e.javaClass.simpleName}"
            throw e
        } finally {
            WidgetDiagnostics.record(
                this, "FCM_HANDLED",
                "topic" to topic, "elapsedMs" to (System.currentTimeMillis() - startedAt), "outcome" to outcome,
            )
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

    /** @return FCM_HANDLED outcome — [onMessageReceived] 참고. */
    private suspend fun consumeSermonEvent(message: RemoteMessage): String {
        if (message.data.isEmpty()) return "skipped:empty_data"

        val sermonDto = runCatching { messageToSermonV2(message.data) }
            .onFailure { e ->
                CrashlyticsHelper.recordException(e, "Failed to parse sermon v2 data: ${message.data}")
            }
            .getOrElse { e -> return "failed:parse:${e.javaClass.simpleName}" }

        Timber.d("Parsed sermon v2: ${sermonDto.title}")

        // 레거시 sermon_events(_v2)는 '전체' 옵션 전용 콘텐츠다. 특정 예배시간을 선택한 사용자의 위젯/
        // '지금 화면' 슬롯을 덮어쓰면 안 된다([#307]) — JS(useFCMListener)와 동일하게 '전체'일 때만 반영하고,
        // 그 외엔 legacy 전용 캐시만 갱신해 나중에 '전체'로 전환하면 바로 보이게 한다.
        // 앱이 완전히 종료된 상태에선 JS가 없어 이 판단을 네이티브가 직접 해야 한다.
        var settingReadError: Throwable? = null
        val isAllSetting = runCatching {
            withContext(Dispatchers.IO) {
                WorshipSetting.isAll(asyncStorage.get(WorshipSetting.ASYNC_STORAGE_KEY))
            }
        }.onFailure { e ->
            CrashlyticsHelper.recordException(e, "Failed to read worship setting for sermon v2")
            settingReadError = e
        }.getOrDefault(false)
        Timber.d("sermon v2 isAllSetting=$isAllSetting")

        // 설정 읽기 실패로 '전체'가 아니라고 간주한 경우는 정상 skip과 구분한다.
        var outcome = settingReadError?.let { "failed:read_setting:${it.javaClass.simpleName}" }
            ?: "skipped:not_all_setting"
        if (isAllSetting) {
            outcome = runCatching {
                withContext(NonCancellable) {
                    sermonRepository.save(sermonDto)
                    AnalyticsHelper.logUpdateSermonEvent(SermonEventSource.FCM_TOPIC)
                }
            }.fold(
                onSuccess = { "applied" },
                onFailure = { e ->
                    CrashlyticsHelper.recordException(e, "Failed to save sermon v2: $sermonDto")
                    "failed:save:${e.javaClass.simpleName}"
                },
            )
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
            outcome += ",failed:cache_broadcast:${e.javaClass.simpleName}"
        }
        return outcome
    }

    /**
     * sermons-v2: 한 주에 예배별(worship_type) 문서가 최대 4번 개별 발행된다. 레거시 [consumeSermonEvent]처럼
     * 무조건 단일 슬롯/위젯에 쓰면 선택하지 않은 예배가 위젯을 덮어쓰므로 worship_type을 구분해 처리한다([#306]).
     * 앱이 완전히 종료돼 JS가 없는 상태에서도 처리가 끝나야 하므로 JS(useFCMListener)와 동일한 판단을
     * 네이티브에서 먼저 수행한다:
     * 1. weekly_sermons(AsyncStorage) 캐시에 이 문서를 병합 — '전체'/불일치여도 항상(설정 변경 시 바로 쓰도록).
     * 2. 현재 예배시간 설정과 worship_type이 일치하면('전체' 제외) 위젯 + fcm_sermon 슬롯 즉시 갱신.
     * 이후 JS가 살아 있으면 브로드캐스트를 받아 같은 병합/반영을 한 번 더 하는데, 결과가 같아 무해하다.
     *
     * @return FCM_HANDLED outcome — [onMessageReceived] 참고.
     */
    private suspend fun consumeSermonsV2Event(message: RemoteMessage): String {
        val outcome = if (message.data.isNotEmpty()) {
            runCatching {
                withContext(NonCancellable + Dispatchers.IO) { applySermonsV2Event(message.data) }
            }.getOrElse { e ->
                CrashlyticsHelper.recordException(e, "Failed to apply sermons-v2 event: ${message.data}")
                "failed:apply:${e.javaClass.simpleName}"
            }
        } else {
            "skipped:empty_data"
        }

        val intent = Intent(ACTION_SERMON_UPDATE_EVENT)
        if (message.data.isNotEmpty()) {
            intent.putExtra(EXTRA_SERMON_EVENT_DATA, HashMap(message.data))
        }
        LocalBroadcastManager
            .getInstance(this@MyFirebaseMessagingService)
            .sendBroadcast(intent)
        return outcome
    }

    private suspend fun applySermonsV2Event(data: Map<String, String>): String {
        var bibleRefsFailed = false
        val event = WeeklySermons.parseEvent(data) { bibleRefsJson ->
            // JS와 동일하게 해석 실패(빈 bible_references = "말씀 없는 날" 등)는 이벤트를 버리지 않고 빈 본문으로 둔다.
            runCatching { bibleReferenceResolver.resolveBibleReferencesJson(bibleRefsJson) }
                .onFailure { e ->
                    bibleRefsFailed = true
                    Timber.w(e, "sermons-v2: failed to resolve bible_references")
                    CrashlyticsHelper.recordException(e, "sermons-v2: failed to resolve bible_references")
                }
                .getOrDefault("")
        } ?: return "skipped:no_week_or_worship_type" // patch 불가, JS 폴백에 맡긴다

        val shouldApply = weeklySermonsMutex.withLock {
            val merged = WeeklySermons.merge(
                existingJson = asyncStorage.get(WeeklySermons.ASYNC_STORAGE_WEEKLY_SERMONS),
                event = event,
            )
            asyncStorage.set(key = WeeklySermons.ASYNC_STORAGE_WEEKLY_SERMONS, value = merged)
            WeeklySermons.shouldApplyToWidget(
                storedSetting = asyncStorage.get(WorshipSetting.ASYNC_STORAGE_KEY),
                worshipType = event.worshipType,
                week = event.week,
            )
        }
        Timber.d("sermons-v2 ${event.week}/${event.worshipType} cached, applyToWidget=$shouldApply")
        if (!shouldApply) return "skipped:worship_type_mismatch"

        sermonRepository.save(event.dto)
        AnalyticsHelper.logUpdateSermonEvent(SermonEventSource.FCM_TOPIC)
        // JS의 saveSermonToAsyncStorage(patched)와 동일 — 앱 실행 시 '지금 화면' 슬롯도 최신이 되도록.
        asyncStorage.set(key = ASYNC_STORAGE_FCM_SERMON, value = event.cacheEntry.toString())
        // 본문 해석에 실패해 빈 본문으로 반영한 경우를 구분한다.
        return if (bibleRefsFailed) "applied,degraded:bible_references" else "applied"
    }

    /** @return FCM_HANDLED outcome — [onMessageReceived] 참고. */
    private suspend fun consumeQtEvent(message: RemoteMessage): String {
        if (message.data.isEmpty()) return "skipped:empty_data"

        val qtDto = runCatching { messageToQt(message.data) }
            .onFailure { e ->
                CrashlyticsHelper.recordException(e, "Failed to parse qt data: ${message.data}")
            }
            .getOrElse { e -> return "failed:parse:${e.javaClass.simpleName}" }

        Timber.d("Parsed qt: ${qtDto.title}")

        var outcome = runCatching {
            withContext(NonCancellable) {
                qtRepository.save(qtDto)
            }
        }.fold(
            onSuccess = { "applied" },
            onFailure = { e ->
                CrashlyticsHelper.recordException(e, "Failed to save qt: $qtDto")
                "failed:save:${e.javaClass.simpleName}"
            },
        )

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
            outcome += ",failed:cache_broadcast:${e.javaClass.simpleName}"
        }
        return outcome
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
