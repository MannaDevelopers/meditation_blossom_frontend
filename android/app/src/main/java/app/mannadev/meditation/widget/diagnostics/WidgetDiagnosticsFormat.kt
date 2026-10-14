package app.mannadev.meditation.widget.diagnostics

import app.mannadev.meditation.widget.state.WidgetContentState
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/**
 * 위젯 진단 로그의 순수 로직([ISSUE-334]). Android 의존이 없어 단위 테스트한다.
 * 한 이벤트 = 한 줄 = "<ISO 시각> <EVENT> key=value ...".
 */
internal object WidgetDiagnosticsFormat {
    /** 파일이 TRIM_THRESHOLD_BYTES를 넘으면 최근 MAX_LOG_LINES줄만 남긴다. 남는 크기가 임계값보다 충분히 작아(히스테리시스) trim이 드물게 실행된다. */
    const val MAX_LOG_LINES = 4000
    const val TRIM_THRESHOLD_BYTES = 1_500_000L

    /** 리포트에는 최근 72시간, 30분 주기로 반복되는 잡음 이벤트를 뺀 줄만 싣는다. */
    const val REPORT_WINDOW_MILLIS = 72L * 60 * 60 * 1000
    val REPORT_EXCLUDED_EVENTS = setOf("ON_UPDATE", "PROVIDE_GLANCE")

    /** 클립보드/카카오톡 전달용 리포트 최대 길이. 넘으면 오래된 줄부터 잘라 환경/스냅샷(뒤쪽)을 보존한다. */
    const val REPORT_MAX_CHARS = 100_000

    private val TIME_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSSXXX")

    fun formatEntry(epochMillis: Long, zone: ZoneId, event: String, fields: List<Pair<String, Any?>>): String {
        val time = TIME_FORMAT.format(Instant.ofEpochMilli(epochMillis).atZone(zone))
        val body = fields.joinToString(" ") { (key, value) -> "$key=$value" }
        val line = if (body.isEmpty()) "$time $event" else "$time $event $body"
        return line.replace('\n', ' ').replace('\r', ' ')
    }

    fun keepLastLines(lines: List<String>, max: Int): List<String> = lines.takeLast(max)

    fun selectReportLines(
        lines: List<String>,
        nowMillis: Long,
        windowMillis: Long = REPORT_WINDOW_MILLIS,
        excludedEvents: Set<String> = REPORT_EXCLUDED_EVENTS,
    ): List<String> = lines.filter { line ->
        val tokens = line.split(' ', limit = 3)
        val time = runCatching { OffsetDateTime.parse(tokens[0]).toInstant().toEpochMilli() }.getOrNull()
            ?: return@filter true // 파싱 불가 줄은 버리지 않는다(진단 데이터 유실 방지)
        val event = tokens.getOrNull(1).orEmpty()
        nowMillis - time <= windowMillis && event !in excludedEvents
    }

    /** Crashlytics 로그(세션당 최근 64KB)에 맞추기 위해 가장 최근 줄부터 maxChars 안에 드는 만큼 고른다. */
    fun tailWithinChars(lines: List<String>, maxChars: Int): List<String> {
        var total = 0
        return lines.asReversed().takeWhile { line ->
            total += line.length + 1
            total - 1 <= maxChars
        }.asReversed()
    }

    /**
     * 리포트용으로 UPDATE_ALL 잡음을 줄인다: (1) glanceIds/systemIds가 둘 다 비었거나 null인 줄 제거,
     * (2) reason이 "refresh_"로 시작하고 glanceIds와 systemIds가 같은 줄 제거. 제거한 줄 수는 맨 앞 한 줄로 요약한다.
     * 그 외 줄(특히 glanceIds != systemIds인 UPDATE_ALL)은 그대로 둔다.
     */
    fun compactReportLines(lines: List<String>): List<String> {
        var emptyCount = 0
        var refreshCount = 0
        val kept = lines.filter { line ->
            if (line.split(' ', limit = 3).getOrNull(1) != "UPDATE_ALL") return@filter true
            val glanceIds = GLANCE_IDS_REGEX.find(line)?.groupValues?.get(1)
            val systemIds = SYSTEM_IDS_REGEX.find(line)?.groupValues?.get(1)
            val reason = REASON_REGEX.find(line)?.groupValues?.get(1)
            when {
                isEmptyIdList(glanceIds) && isEmptyIdList(systemIds) -> {
                    emptyCount++
                    false
                }
                reason != null && reason.startsWith("refresh_") && glanceIds != null && glanceIds == systemIds -> {
                    refreshCount++
                    false
                }
                else -> true
            }
        }
        if (emptyCount + refreshCount == 0) return kept
        val summary = "(omitted $emptyCount UPDATE_ALL lines without placed widgets, " +
            "$refreshCount refresh UPDATE_ALL lines with glanceIds==systemIds)"
        return listOf(summary) + kept
    }

    private val GLANCE_IDS_REGEX = Regex("""glanceIds=(\[[^\]]*\]|null)""")
    private val SYSTEM_IDS_REGEX = Regex("""systemIds=(\[[^\]]*\]|null)""")
    private val REASON_REGEX = Regex("""reason=(\S+)""")

    // 필드 자체가 없는(형식이 다른) 줄은 비었다고 보지 않는다 — 진단 데이터를 함부로 버리지 않기 위함.
    private fun isEmptyIdList(value: String?): Boolean = value == "null" || value == "[]"

    fun <T> summarizeState(state: WidgetContentState<T>, describe: (T) -> String): String = when (state) {
        is WidgetContentState.Loading -> "Loading"
        is WidgetContentState.NoDataYet -> "NoDataYet"
        is WidgetContentState.Data -> "Data(${describe(state.value)})"
        is WidgetContentState.Error -> "Error(${state.throwable.javaClass.simpleName})"
    }

    fun summarizeOptions(options: Map<String, Any?>): String =
        options.toSortedMap().entries.joinToString(", ", prefix = "{", postfix = "}") { (k, v) -> "$k=$v" }
}

/**
 * SizeMode.Exact에서는 같은 위젯 ID의 composition이 크기별로 연달아 돌므로, 같은 내용의 RENDER가
 * 짧은 시간 안에 반복되면 한 번만 기록한다. 데이터가 바뀌었거나 창이 지나면 다시 기록한다.
 */
internal class RenderDedupe(private val windowMillis: Long = 5_000) {
    private val last = HashMap<Int, Pair<String, Long>>()

    @Synchronized
    fun shouldRecord(appWidgetId: Int, summary: String, nowMillis: Long): Boolean {
        val previous = last[appWidgetId]
        if (previous != null && previous.first == summary && nowMillis - previous.second < windowMillis) {
            return false
        }
        last[appWidgetId] = summary to nowMillis
        return true
    }
}
