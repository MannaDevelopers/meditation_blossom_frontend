package app.mannadev.meditation.data

import app.mannadev.meditation.dto.SermonDto
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.put
import java.time.Instant
import java.time.OffsetDateTime

/**
 * sermons-v2(`sermons_v2_events`) FCM을 네이티브에서 끝까지 처리하기 위한 순수 로직([#306]).
 *
 * JS(`sermonService.upsertWeeklySermonFromEvent` / `useFCMListener`)와 같은 AsyncStorage 키를
 * 같은 모양으로 읽고 쓰므로, 앱이 종료된 상태에서 네이티브가 먼저 처리해둔 결과를 JS가 나중에
 * 그대로 읽는다. 규칙이 JS와 어긋나면 앱 실행 시 캐시가 뒤섞이므로 변경 시 양쪽을 같이 고쳐야 한다.
 */
object WeeklySermons {

    /** JS `WEEKLY_SERMONS_KEY` */
    const val ASYNC_STORAGE_WEEKLY_SERMONS = "weekly_sermons"

    private const val KEY_ID = "id"
    private const val KEY_TITLE = "title"
    private const val KEY_CONTENT = "content"
    private const val KEY_DATE = "date"
    private const val KEY_CATEGORY = "category"
    private const val KEY_DAY_OF_WEEK = "day_of_week"
    private const val KEY_DAY_OF_WEEK_CAMEL = "dayOfWeek"
    private const val KEY_VIDEO_URL = "video_url"
    private const val KEY_WORSHIP_TYPE = "worship_type"
    private const val KEY_WEEK = "week"
    private const val KEY_BIBLE_REFERENCES = "bible_references"
    private const val KEY_CREATED_AT = "created_at"
    private const val KEY_CREATED_AT_CAMEL = "createdAt"
    private const val KEY_UPDATED_AT = "updated_at"
    private const val KEY_UPDATED_AT_CAMEL = "updatedAt"

    private val json = Json { ignoreUnknownKeys = true }

    /** sermons-v2 FCM 1건을 파싱한 결과. [cacheEntry]는 JS `Sermon`과 동일한 모양의 JSON이다. */
    data class Event(
        val week: String,
        val worshipType: String,
        val cacheEntry: JsonObject,
        val dto: SermonDto,
    )

    /**
     * FCM data → [Event]. week/worship_type이 없으면 캐시에 patch할 수 없으므로 null(JS와 동일).
     *
     * [resolveContent]는 `bible_references` JSON → 본문 텍스트 변환이다. payload에 content가 이미 있으면
     * 호출하지 않는다(JS와 동일). 변환 실패 처리(로깅 후 빈 문자열 반환 등)는 호출자 몫이다.
     */
    fun parseEvent(
        data: Map<String, String>,
        resolveContent: (bibleReferencesJson: String) -> String,
    ): Event? {
        val week = data[KEY_WEEK]?.takeIf { it.isNotEmpty() } ?: return null
        val worshipType = data[KEY_WORSHIP_TYPE]?.takeIf { it.isNotEmpty() } ?: return null

        val bibleReferences = data[KEY_BIBLE_REFERENCES]
        val content = data[KEY_CONTENT]?.takeIf { it.isNotEmpty() }
            ?: bibleReferences?.takeIf { it.isNotEmpty() }?.let { resolveContent(it) }
            ?: ""
        // sermons-v2 payload엔 id가 없다 — Firestore 문서 ID 규칙과 동일하게 구성한다(JS와 동일).
        val id = data[KEY_ID]?.takeIf { it.isNotEmpty() } ?: "${week}_$worshipType"
        val title = data[KEY_TITLE].orEmpty()
        val date = data[KEY_DATE].orEmpty()
        // sermons-v2 payload엔 day_of_week가 없다 — JS fcmDataToSermon과 동일하게 빈 문자열로 채운다.
        val dayOfWeek = data[KEY_DAY_OF_WEEK]?.takeIf { it.isNotEmpty() }
            ?: data[KEY_DAY_OF_WEEK_CAMEL]?.takeIf { it.isNotEmpty() }
            ?: ""
        val videoUrl = data[KEY_VIDEO_URL]

        // JS JSON.stringify는 undefined 필드를 생략하므로 없는 선택 필드는 키 자체를 넣지 않는다.
        val cacheEntry = buildJsonObject {
            put(KEY_ID, id)
            put(KEY_TITLE, title)
            put(KEY_CONTENT, content)
            put(KEY_DATE, date)
            data[KEY_CATEGORY]?.let { put(KEY_CATEGORY, it) }
            put(KEY_DAY_OF_WEEK, dayOfWeek)
            videoUrl?.let { put(KEY_VIDEO_URL, it) }
            put(KEY_WORSHIP_TYPE, worshipType)
            put(KEY_WEEK, week)
            bibleReferences?.let { put(KEY_BIBLE_REFERENCES, it) }
            put(KEY_CREATED_AT, timestampJson(data[KEY_CREATED_AT] ?: data[KEY_CREATED_AT_CAMEL]))
            put(KEY_UPDATED_AT, timestampJson(data[KEY_UPDATED_AT] ?: data[KEY_UPDATED_AT_CAMEL]))
        }

        val dto = SermonDto(
            date = date,
            title = title,
            content = content,
            dayOfWeek = dayOfWeek,
            videoUrl = videoUrl?.takeIf { it.isNotBlank() },
        )
        return Event(week = week, worshipType = worshipType, cacheEntry = cacheEntry, dto = dto)
    }

    /**
     * 기존 `weekly_sermons` JSON 배열에 [event]를 병합한 새 JSON 배열 문자열을 반환한다.
     * JS `upsertWeeklySermonFromEvent`/`mergeWeeklySermonIntoCache`와 동일한 규칙([ISSUE-329]):
     * - (week, worship_type)이 같은 항목만 교체한다. 다른 예배/다른 주 항목은 보존한다 —
     *   이번 주 FCM이 왔다고 지난주 항목을 지우면, 아직 이번 주 예배 시각 전인 다른 예배시간
     *   설정에서 "지난주 말씀"을 보여줄 수 없다.
     * - 무한히 쌓이지 않도록 가장 최근 [MAX_CACHED_WEEKS]개 주만 남긴다.
     * 기존 값이 없거나 깨진 JSON이면 빈 캐시로 간주한다(JS는 깨진 캐시를 삭제 후 빈 배열로 취급).
     * 보존되는 항목은 JS가 쓴 JSON을 그대로 옮겨 필드 손실이 없게 한다.
     */
    fun merge(existingJson: String?, event: Event): String {
        val existing = existingJson
            ?.let { runCatching { json.parseToJsonElement(it) as? JsonArray }.getOrNull() }
            .orEmpty()
        val preserved = existing.filter { element ->
            val obj = element as? JsonObject ?: return@filter false
            !(obj.stringField(KEY_WEEK) == event.week &&
                obj.stringField(KEY_WORSHIP_TYPE) == event.worshipType)
        }
        return JsonArray(pruneToRecentWeeks(preserved + event.cacheEntry)).toString()
    }

    /** weekly_sermons 캐시에 보관할 최근 주 수. JS `WEEKLY_CACHE_MAX_WEEKS`와 같아야 한다. */
    const val MAX_CACHED_WEEKS = 3

    /** 가장 최근 [MAX_CACHED_WEEKS]개 주의 항목만 남긴다. week가 없는 항목은 그대로 둔다(JS `pruneWeeklySermons`). */
    private fun pruneToRecentWeeks(entries: List<JsonElement>): List<JsonElement> {
        val keepWeeks = entries
            .mapNotNull { (it as? JsonObject)?.stringField(KEY_WEEK)?.takeIf { w -> w.isNotEmpty() } }
            .distinct()
            .sortedDescending()
            .take(MAX_CACHED_WEEKS)
            .toSet()
        return entries.filter { element ->
            val week = (element as? JsonObject)?.stringField(KEY_WEEK)?.takeIf { it.isNotEmpty() }
            week == null || week in keepWeeks
        }
    }

    /**
     * 현재 예배시간 설정([storedSetting], AsyncStorage 원시값)에서 이 이벤트가 위젯/화면에 반영돼야 하는지.
     * '전체'면 sermons-v2는 반영하지 않고([#303]), 설정이 없으면 JS와 동일하게 기본 예배로 본다([WorshipSetting.resolve]).
     * 설정과 일치해도 그 예배 시각이 아직 안 됐으면 반영하지 않는다([ISSUE-315], [WorshipSchedule]) —
     * FCM은 주보 등록 시점에 미리 도착하므로, 실제 예배가 시작되기 전까지는 위젯에 반영하면 안 된다.
     * [week]을 넘기지 않으면(기존 호출부 호환) 시각 판별 불가로 간주해 항상 즉시 반영한다.
     */
    fun shouldApplyToWidget(
        storedSetting: String?,
        worshipType: String,
        week: String? = null,
        now: java.time.Instant = java.time.Instant.now(),
    ): Boolean {
        val setting = WorshipSetting.resolve(storedSetting)
        return setting != WorshipSetting.ALL && setting == worshipType &&
            WorshipSchedule.hasWorshipTimeArrived(week, worshipType, now)
    }

    /**
     * `weekly_sermons` 캐시(JSON 배열 문자열)에서 [worshipType]과 일치하고 예배 시각이 이미
     * 지난 항목 중 **week가 가장 최신인 것**을 찾는다([ISSUE-315], [ISSUE-329]). 이번 주 항목이
     * 아직 시각 전이면 지난주 항목이 반환된다 — JS `selectGatedWeeklySermon`과 같은 규칙이다.
     * FCM 수신 시점엔 시각이 안 돼서 위젯에 반영되지 못하고 캐시에만 남아 있던 이벤트를, 위젯이
     * 주기적으로(30분 간격) 다시 그려질 때 이 함수로 재확인해 뒤늦게라도 반영한다.
     * 일치하는 항목이 없거나 전부 시각 전이면 null.
     */
    fun findArrivedEntry(
        weeklySermonsJson: String?,
        worshipType: String,
        now: Instant = Instant.now(),
    ): JsonObject? {
        val entries = weeklySermonsJson
            ?.let { runCatching { json.parseToJsonElement(it) as? JsonArray }.getOrNull() }
            ?: return null
        return entries
            .filterIsInstance<JsonObject>()
            .filter { it.stringField(KEY_WORSHIP_TYPE) == worshipType }
            .mapNotNull { entry -> entry.stringField(KEY_WEEK)?.let { week -> week to entry } }
            .sortedByDescending { (week, _) -> week }
            .firstOrNull { (week, _) -> WorshipSchedule.hasWorshipTimeArrived(week, worshipType, now) }
            ?.second
    }

    /** [findArrivedEntry]가 찾은 캐시 항목(JS `Sermon` 모양)을 위젯 저장 계층의 [SermonDto]로 변환한다. */
    fun cacheEntryToSermonDto(entry: JsonObject): SermonDto = SermonDto(
        date = entry.stringField(KEY_DATE).orEmpty(),
        title = entry.stringField(KEY_TITLE).orEmpty(),
        content = entry.stringField(KEY_CONTENT).orEmpty(),
        dayOfWeek = entry.stringField(KEY_DAY_OF_WEEK).orEmpty(),
        videoUrl = entry.stringField(KEY_VIDEO_URL)?.takeIf { it.isNotBlank() },
    )

    private fun JsonObject.stringField(key: String): String? =
        (this[key] as? JsonPrimitive)?.contentOrNull

    /** JS `convertStringToTimestamp`와 같은 `{seconds, nanoseconds}` 모양. 파싱 불가/없음이면 0. */
    private fun timestampJson(value: String?): JsonElement {
        val millis = value?.trim()?.takeIf { it.isNotEmpty() }?.let { parseIsoMillis(it) } ?: 0L
        return buildJsonObject {
            put("seconds", Math.floorDiv(millis, 1000L))
            put("nanoseconds", Math.floorMod(millis, 1000L) * 1_000_000L)
        }
    }

    private fun parseIsoMillis(value: String): Long? =
        runCatching { Instant.parse(value).toEpochMilli() }.getOrNull()
            ?: runCatching { OffsetDateTime.parse(value).toInstant().toEpochMilli() }.getOrNull()
}
