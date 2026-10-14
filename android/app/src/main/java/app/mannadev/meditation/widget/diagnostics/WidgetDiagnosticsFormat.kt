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
    /** 파일이 TRIM_THRESHOLD_BYTES를 넘으면 최근 MAX_LOG_LINES줄만 남긴다(대략 수일치). */
    const val MAX_LOG_LINES = 8000
    const val TRIM_THRESHOLD_BYTES = 1_500_000L

    /** 리포트에는 최근 72시간, 30분 주기로 반복되는 잡음 이벤트를 뺀 줄만 싣는다. */
    const val REPORT_WINDOW_MILLIS = 72L * 60 * 60 * 1000
    val REPORT_EXCLUDED_EVENTS = setOf("ON_UPDATE", "PROVIDE_GLANCE")

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
