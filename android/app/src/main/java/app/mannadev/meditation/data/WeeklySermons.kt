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
     * JS `upsertWeeklySermonFromEvent`와 동일한 규칙:
     * - 같은 week의 다른 worship_type 항목은 보존하고, 같은 worship_type 항목은 교체한다.
     * - 다른 week 항목은 모두 버린다(주가 바뀌는 시점에 이전 주 예배와 섞이지 않도록).
     * 기존 값이 없거나 깨진 JSON이면 빈 캐시로 간주한다(JS는 깨진 캐시를 삭제 후 빈 배열로 취급).
     * 보존되는 항목은 JS가 쓴 JSON을 그대로 옮겨 필드 손실이 없게 한다.
     */
    fun merge(existingJson: String?, event: Event): String {
        val existing = existingJson
            ?.let { runCatching { json.parseToJsonElement(it) as? JsonArray }.getOrNull() }
            .orEmpty()
        val sameWeekOthers = existing.filter { element ->
            val obj = element as? JsonObject ?: return@filter false
            obj.stringField(KEY_WEEK) == event.week &&
                obj.stringField(KEY_WORSHIP_TYPE) != event.worshipType
        }
        return JsonArray(sameWeekOthers + event.cacheEntry).toString()
    }

    /**
     * 현재 예배시간 설정([storedSetting], AsyncStorage 원시값)에서 이 이벤트가 위젯/화면에 반영돼야 하는지.
     * '전체'면 sermons-v2는 반영하지 않고([#303]), 설정이 없으면 JS와 동일하게 기본 예배로 본다([WorshipSetting.resolve]).
     */
    fun shouldApplyToWidget(storedSetting: String?, worshipType: String): Boolean {
        val setting = WorshipSetting.resolve(storedSetting)
        return setting != WorshipSetting.ALL && setting == worshipType
    }

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
