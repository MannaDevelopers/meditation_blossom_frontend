package app.mannadev.meditation.widget.diagnostics

import app.mannadev.meditation.widget.state.WidgetContentState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant
import java.time.ZoneId

class WidgetDiagnosticsFormatTest {

    private val kst = ZoneId.of("Asia/Seoul")
    private fun millis(iso: String) = Instant.parse(iso).toEpochMilli()

    @Test
    fun `formatEntry renders iso time, event and key=value fields`() {
        val entry = WidgetDiagnosticsFormat.formatEntry(
            epochMillis = millis("2026-10-11T20:30:21.123Z"),
            zone = kst,
            event = "FCM_RECEIVED",
            fields = listOf("topic" to "qt_events", "date" to "2026-10-12", "ids" to listOf(12, 34), "none" to null),
        )
        assertEquals(
            "2026-10-12T05:30:21.123+09:00 FCM_RECEIVED topic=qt_events date=2026-10-12 ids=[12, 34] none=null",
            entry,
        )
    }

    @Test
    fun `formatEntry replaces newlines so one entry stays one line`() {
        val entry = WidgetDiagnosticsFormat.formatEntry(0L, kst, "RENDER", listOf("data" to "a\nb\r\nc"))
        assertFalse(entry.contains('\n'))
        assertFalse(entry.contains('\r'))
        assertTrue(entry.endsWith("data=a b  c"))
    }

    @Test
    fun `keepLastLines drops oldest lines beyond max`() {
        assertEquals(listOf("e3", "e4", "e5"), WidgetDiagnosticsFormat.keepLastLines(listOf("e1", "e2", "e3", "e4", "e5"), 3))
        assertEquals(listOf("e1"), WidgetDiagnosticsFormat.keepLastLines(listOf("e1"), 3))
    }

    @Test
    fun `selectReportLines keeps window, drops noisy events, keeps unparsable lines`() {
        val now = millis("2026-10-14T00:00:00Z")
        val old = WidgetDiagnosticsFormat.formatEntry(millis("2026-10-10T00:00:00Z"), kst, "FCM_RECEIVED", emptyList())
        val recentFcm = WidgetDiagnosticsFormat.formatEntry(millis("2026-10-13T00:00:00Z"), kst, "FCM_RECEIVED", emptyList())
        val recentNoise = WidgetDiagnosticsFormat.formatEntry(millis("2026-10-13T00:00:01Z"), kst, "ON_UPDATE", emptyList())
        val broken = "garbage line"
        val selected = WidgetDiagnosticsFormat.selectReportLines(
            listOf(old, recentFcm, recentNoise, broken),
            nowMillis = now,
            windowMillis = 72L * 60 * 60 * 1000,
            excludedEvents = setOf("ON_UPDATE"),
        )
        assertEquals(listOf(recentFcm, broken), selected)
    }

    @Test
    fun `tailWithinChars keeps newest lines that fit`() {
        assertEquals(listOf("bbb", "cc"), WidgetDiagnosticsFormat.tailWithinChars(listOf("aaaa", "bbb", "cc"), maxChars = 7))
    }

    @Test
    fun `summarizeState describes each state`() {
        assertEquals("Loading", WidgetDiagnosticsFormat.summarizeState(WidgetContentState.Loading) { _: String -> "" })
        assertEquals("NoDataYet", WidgetDiagnosticsFormat.summarizeState(WidgetContentState.NoDataYet) { _: String -> "" })
        assertEquals("Data(2026-10-12)", WidgetDiagnosticsFormat.summarizeState(WidgetContentState.Data("2026-10-12")) { it })
        assertEquals(
            "Error(IllegalStateException)",
            WidgetDiagnosticsFormat.summarizeState(WidgetContentState.Error(IllegalStateException("x"))) { _: String -> "" },
        )
    }

    @Test
    fun `summarizeOptions sorts keys`() {
        val summary = WidgetDiagnosticsFormat.summarizeOptions(
            mapOf("appWidgetMinWidth" to 245, "appWidgetCategory" to 1, "appWidgetSizes" to listOf("245.0x115.0")),
        )
        assertEquals("{appWidgetCategory=1, appWidgetMinWidth=245, appWidgetSizes=[245.0x115.0]}", summary)
    }

    @Test
    fun `RenderDedupe suppresses same summary within window per widget id`() {
        val dedupe = RenderDedupe(windowMillis = 5_000)
        assertTrue(dedupe.shouldRecord(12, "Data(2026-10-12)", nowMillis = 1_000))
        assertFalse(dedupe.shouldRecord(12, "Data(2026-10-12)", nowMillis = 1_010)) // ForEachSize 반복
        assertTrue(dedupe.shouldRecord(34, "Data(2026-10-12)", nowMillis = 1_020)) // 다른 위젯 ID
        assertTrue(dedupe.shouldRecord(12, "Data(2026-10-13)", nowMillis = 1_030)) // 데이터 변경
        assertTrue(dedupe.shouldRecord(12, "Data(2026-10-13)", nowMillis = 7_000)) // 창 경과 후 재렌더
    }
}
