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
    fun `keepLastBytes keeps newest lines whose utf-8 size with newlines fits`() {
        // "가나다"는 UTF-8로 9바이트 + 개행 1 = 10바이트. 줄 수가 아니라 바이트로 잘라야 한글 줄이 많아도 임계값 아래로 내려간다.
        val lines = listOf("오래된줄", "가나다", "abc", "가나다")
        assertEquals(listOf("abc", "가나다"), WidgetDiagnosticsFormat.keepLastBytes(lines, maxBytes = 14))
        assertEquals(listOf("가나다", "abc", "가나다"), WidgetDiagnosticsFormat.keepLastBytes(lines, maxBytes = 24))
        assertEquals(emptyList<String>(), WidgetDiagnosticsFormat.keepLastBytes(lines, maxBytes = 9))
    }

    @Test
    fun `sortByTime orders lines by timestamp and keeps unparsable lines after their predecessor`() {
        val lines = listOf(
            "2026-10-14T19:00:02.000+09:00 RENDER id=3",
            "2026-10-14T19:00:01.000+09:00 JS_PUSH type=qt",
            "garbage line",
            "2026-10-14T10:00:00.500Z OPTIONS_CHANGED id=3", // = 19:00:00.500+09:00
        )
        assertEquals(
            listOf(
                "2026-10-14T10:00:00.500Z OPTIONS_CHANGED id=3",
                "2026-10-14T19:00:01.000+09:00 JS_PUSH type=qt",
                "garbage line",
                "2026-10-14T19:00:02.000+09:00 RENDER id=3",
            ),
            WidgetDiagnosticsFormat.sortByTime(lines),
        )
    }

    @Test
    fun `trim target leaves headroom below the trim threshold`() {
        assertTrue(WidgetDiagnosticsFormat.TRIM_TARGET_BYTES * 4 <= WidgetDiagnosticsFormat.TRIM_THRESHOLD_BYTES * 3)
    }

    @Test
    fun `persistable excludes events the report never shows`() {
        assertFalse(WidgetDiagnosticsFormat.isPersisted("ON_UPDATE"))
        assertFalse(WidgetDiagnosticsFormat.isPersisted("PROVIDE_GLANCE"))
        assertTrue(WidgetDiagnosticsFormat.isPersisted("RENDER"))
        assertTrue(WidgetDiagnosticsFormat.isPersisted("UPDATE_ALL"))
    }

    @Test
    fun `summarizeSermon distinguishes same title with different content`() {
        val a = WidgetDiagnosticsFormat.summarizeSermon(title = "시리즈 설교", bookName = "요한복음", verses = listOf("1절"))
        val b = WidgetDiagnosticsFormat.summarizeSermon(title = "시리즈 설교", bookName = "요한복음", verses = listOf("2절"))
        assertTrue(a.startsWith("시리즈 설교 / 요한복음 #"))
        assertTrue(a != b)
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
    private val t = "2026-10-13T09:00:00.000+09:00"
    private fun updateAll(reason: String, glance: String, system: String) =
        "$t UPDATE_ALL widget=QtWidgetLarge reason=$reason glanceIds=$glance systemIds=$system display=d0(state=2,1856x2160) cfg=673x841dp"

    @Test
    fun `compactReportLines keeps non-UPDATE_ALL lines and adds no summary when nothing dropped`() {
        val lines = listOf(
            "$t FCM_RECEIVED topic=qt_events glanceIds=[] systemIds=[]",
            "$t RENDER widget=QtWidgetLarge id=12 data=Data(2026-10-13)",
            "garbage line",
        )
        assertEquals(lines, WidgetDiagnosticsFormat.compactReportLines(lines))
    }

    @Test
    fun `compactReportLines drops UPDATE_ALL lines with both id lists empty or null`() {
        val bothEmpty = updateAll("fcm_qt", "[]", "[]")
        val emptyAndNull = updateAll("fcm_qt", "[]", "null")
        val kept = updateAll("fcm_qt", "[12]", "[12]")
        val result = WidgetDiagnosticsFormat.compactReportLines(listOf(bothEmpty, emptyAndNull, kept))
        assertEquals(
            listOf(
                "(omitted 2 UPDATE_ALL lines without placed widgets, 0 refresh UPDATE_ALL lines with glanceIds==systemIds)",
                kept,
            ),
            result,
        )
    }

    @Test
    fun `compactReportLines drops refresh UPDATE_ALL lines whose id lists are equal`() {
        val refreshEqual = updateAll("refresh_SCREEN_ON", "[12, 34]", "[12, 34]")
        val result = WidgetDiagnosticsFormat.compactReportLines(listOf(refreshEqual))
        assertEquals(
            listOf("(omitted 0 UPDATE_ALL lines without placed widgets, 1 refresh UPDATE_ALL lines with glanceIds==systemIds)"),
            result,
        )
    }

    @Test
    fun `compactReportLines keeps refresh UPDATE_ALL lines whose id lists differ`() {
        val refreshUnequal = updateAll("refresh_SCREEN_ON", "[12]", "[12, 34]")
        assertEquals(listOf(refreshUnequal), WidgetDiagnosticsFormat.compactReportLines(listOf(refreshUnequal)))
    }

    @Test
    fun `compactReportLines keeps non-refresh UPDATE_ALL lines with equal id lists`() {
        val fcmEqual = updateAll("fcm_qt", "[12, 34]", "[12, 34]")
        assertEquals(listOf(fcmEqual), WidgetDiagnosticsFormat.compactReportLines(listOf(fcmEqual)))
    }

    @Test
    fun `compactReportLines summary counts both kinds and precedes remaining lines`() {
        val fcm = "$t FCM_RECEIVED topic=qt_events"
        val empty = updateAll("refresh_SCREEN_ON", "[]", "[]")
        val refreshEqual = updateAll("refresh_USER_PRESENT", "[12]", "[12]")
        val diff = updateAll("refresh_USER_PRESENT", "[]", "[12]")
        val result = WidgetDiagnosticsFormat.compactReportLines(listOf(fcm, empty, refreshEqual, diff))
        assertEquals(
            listOf(
                "(omitted 1 UPDATE_ALL lines without placed widgets, 1 refresh UPDATE_ALL lines with glanceIds==systemIds)",
                fcm,
                diff,
            ),
            result,
        )
    }
}
