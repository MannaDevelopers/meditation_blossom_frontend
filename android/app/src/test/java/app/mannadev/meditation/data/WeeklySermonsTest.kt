package app.mannadev.meditation.data

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.long
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class WeeklySermonsTest {

    private val bibleRefs =
        """[{"book": "열왕기하", "chapter": 22, "verse_start": 2, "verse_end": 2}]"""

    private fun payload(
        week: String = "2026-W39",
        worshipType: String = "SUN_1150",
        extra: Map<String, String> = emptyMap(),
    ): Map<String, String> = mapOf(
        "title" to "설교 제목",
        "date" to "2026-09-27",
        "week" to week,
        "worship_type" to worshipType,
        "bible_references" to bibleRefs,
        "source_id" to "src-1",
        "video_url" to "https://youtu.be/abc",
    ) + extra

    private val resolved = "본문 : 열왕기하 22:2 요시야가 여호와 보시기에 정직히 행하여"

    private fun parse(data: Map<String, String>) =
        WeeklySermons.parseEvent(data) { resolved }

    private fun JsonObject.str(key: String): String? = this[key]?.jsonPrimitive?.content

    private fun parseArray(jsonStr: String): List<JsonObject> =
        Json.parseToJsonElement(jsonStr).jsonArray.map { it.jsonObject }

    // --- parseEvent ---

    @Test
    fun `parseEvent returns null without week or worship_type`() {
        assertNull(parse(payload() - "week"))
        assertNull(parse(payload() - "worship_type"))
        assertNull(parse(payload(week = "")))
    }

    @Test
    fun `parseEvent builds JS Sermon shaped cache entry with resolved content`() {
        val event = parse(payload())!!

        assertEquals("2026-W39", event.week)
        assertEquals("SUN_1150", event.worshipType)
        with(event.cacheEntry) {
            // payload엔 id가 없어 Firestore 문서 ID 규칙(week_worshipType)으로 채운다. source_id는 쓰지 않는다.
            assertEquals("2026-W39_SUN_1150", str("id"))
            assertEquals("설교 제목", str("title"))
            assertEquals(resolved, str("content"))
            assertEquals("2026-09-27", str("date"))
            assertEquals("", str("day_of_week"))
            assertEquals("https://youtu.be/abc", str("video_url"))
            assertEquals("SUN_1150", str("worship_type"))
            assertEquals("2026-W39", str("week"))
            assertEquals(bibleRefs, str("bible_references"))
            assertFalse(containsKey("category"))
            assertEquals(0L, this["updated_at"]!!.jsonObject["seconds"]!!.jsonPrimitive.long)
        }
        with(event.dto) {
            assertEquals("2026-09-27", date)
            assertEquals("설교 제목", title)
            assertEquals(resolved, content)
            assertEquals("", dayOfWeek)
            assertEquals("https://youtu.be/abc", videoUrl)
        }
    }

    @Test
    fun `parseEvent keeps payload content and id without resolving`() {
        var resolveCalls = 0
        val event = WeeklySermons.parseEvent(
            payload(extra = mapOf("content" to "이미 있는 본문", "id" to "doc-1")),
        ) { resolveCalls++; resolved }!!

        assertEquals(0, resolveCalls)
        assertEquals("이미 있는 본문", event.cacheEntry.str("content"))
        assertEquals("doc-1", event.cacheEntry.str("id"))
    }

    @Test
    fun `parseEvent uses resolver fallback when references cannot be resolved`() {
        val event = WeeklySermons.parseEvent(payload()) { "" }!!
        assertEquals("", event.cacheEntry.str("content"))
        assertEquals("", event.dto.content)
    }

    @Test
    fun `parseEvent treats blank video_url as null for widget`() {
        val event = parse(payload(extra = mapOf("video_url" to " ")))!!
        assertNull(event.dto.videoUrl)
    }

    @Test
    fun `parseEvent converts ISO updated_at to firestore timestamp shape`() {
        val event = parse(payload(extra = mapOf("updated_at" to "2026-09-23T01:02:03.456Z")))!!
        val ts = event.cacheEntry["updated_at"]!!.jsonObject
        assertEquals(1_790_125_323L, ts["seconds"]!!.jsonPrimitive.long)
        assertEquals(456_000_000L, ts["nanoseconds"]!!.jsonPrimitive.long)
    }

    // --- merge ---

    private fun cached(week: String, worshipType: String, title: String) =
        """{"id":"${week}_$worshipType","title":"$title","content":"c","date":"d","day_of_week":"",""" +
            """"worship_type":"$worshipType","week":"$week","created_at":{"seconds":1,"nanoseconds":0},""" +
            """"updated_at":{"seconds":1,"nanoseconds":0}}"""

    @Test
    fun `merge into empty or missing cache yields only the incoming entry`() {
        val event = parse(payload())!!
        for (existing in listOf(null, "", "[]", "not json", """{"a":1}""")) {
            val merged = parseArray(WeeklySermons.merge(existing, event))
            assertEquals("existing=$existing", listOf(event.cacheEntry), merged)
        }
    }

    @Test
    fun `merge replaces same worship_type and keeps other worship types of same week untouched`() {
        val sat = cached("2026-W39", "SAT_1700", "토요")
        val existing = "[$sat,${cached("2026-W39", "SUN_1150", "옛 11시50분")}," +
            "${cached("2026-W39", "SUN_0950", "9시50분")}]"
        val event = parse(payload())!!

        val merged = parseArray(WeeklySermons.merge(existing, event))

        assertEquals(3, merged.size)
        assertEquals(listOf("SAT_1700", "SUN_0950", "SUN_1150"), merged.map { it.str("worship_type") })
        assertEquals("설교 제목", merged.last().str("title"))
        // 보존된 항목은 JS가 쓴 JSON 그대로(필드 손실 없음)
        assertEquals(Json.parseToJsonElement(sat), merged.first())
    }

    @Test
    fun `merge drops all entries from a different week`() {
        val existing = "[${cached("2026-W38", "SAT_1700", "지난주 토요")}," +
            "${cached("2026-W38", "SUN_0950", "지난주 9시50분")}]"
        val event = parse(payload(week = "2026-W39"))!!

        val merged = parseArray(WeeklySermons.merge(existing, event))

        assertEquals(listOf(event.cacheEntry), merged)
    }

    @Test
    fun `merge output is a JSON array`() {
        val merged = WeeklySermons.merge(null, parse(payload())!!)
        assertTrue(Json.parseToJsonElement(merged) is JsonArray)
    }

    // --- shouldApplyToWidget ---

    @Test
    fun `shouldApplyToWidget only when setting matches worship_type`() {
        assertTrue(WeeklySermons.shouldApplyToWidget("SUN_1150", "SUN_1150"))
        assertFalse(WeeklySermons.shouldApplyToWidget("SUN_0950", "SUN_1150"))
    }

    @Test
    fun `shouldApplyToWidget never applies for ALL setting`() {
        assertFalse(WeeklySermons.shouldApplyToWidget("ALL", "SUN_1150"))
        assertFalse(WeeklySermons.shouldApplyToWidget("ALL", "ALL"))
    }

    @Test
    fun `shouldApplyToWidget falls back to default worship type when unset`() {
        assertTrue(WeeklySermons.shouldApplyToWidget(null, WorshipSetting.DEFAULT_WORSHIP_TYPE))
        assertTrue(WeeklySermons.shouldApplyToWidget("", WorshipSetting.DEFAULT_WORSHIP_TYPE))
        assertFalse(WeeklySermons.shouldApplyToWidget(null, "SUN_1150"))
    }
}
