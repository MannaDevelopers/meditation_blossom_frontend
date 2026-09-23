package app.mannadev.meditation.data

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class WorshipSettingTest {

    @Test
    fun `resolve falls back to default worship type when unset`() {
        assertEquals(WorshipSetting.DEFAULT_WORSHIP_TYPE, WorshipSetting.resolve(null))
        assertEquals(WorshipSetting.DEFAULT_WORSHIP_TYPE, WorshipSetting.resolve(""))
        assertEquals("SUN_1150", WorshipSetting.resolve("SUN_1150"))
    }

    @Test
    fun `isAll only for ALL setting`() {
        assertTrue(WorshipSetting.isAll("ALL"))
        assertFalse(WorshipSetting.isAll("SUN_1150"))
        // 미설정은 JS와 동일하게 기본 예배(SUN_0950)로 취급 — '전체'가 아니다
        assertFalse(WorshipSetting.isAll(null))
        assertFalse(WorshipSetting.isAll(""))
    }

    @Test
    fun `legacyCacheJson fills id from source_id and keeps payload fields`() {
        val json = WorshipSetting.legacyCacheJson(
            mapOf("title" to "제목", "date" to "2026-09-27", "content" to "본문", "source_id" to "src-1"),
        )
        val obj = Json.parseToJsonElement(json).jsonObject

        assertEquals("src-1", obj["id"]!!.jsonPrimitive.content)
        assertEquals("제목", obj["title"]!!.jsonPrimitive.content)
        assertEquals("2026-09-27", obj["date"]!!.jsonPrimitive.content)
        assertEquals("본문", obj["content"]!!.jsonPrimitive.content)
    }

    @Test
    fun `legacyCacheJson keeps existing id and uses empty id without source_id`() {
        val withId = Json.parseToJsonElement(
            WorshipSetting.legacyCacheJson(mapOf("id" to "doc-1", "source_id" to "src-1")),
        ).jsonObject
        assertEquals("doc-1", withId["id"]!!.jsonPrimitive.content)

        val noSource = Json.parseToJsonElement(WorshipSetting.legacyCacheJson(mapOf("title" to "t"))).jsonObject
        assertEquals("", noSource["id"]!!.jsonPrimitive.content)
    }
}
