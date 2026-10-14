package app.mannadev.meditation.widget.diagnostics

import android.app.usage.UsageStatsManager
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.hardware.display.DisplayManager
import android.os.Build
import android.os.Bundle
import android.os.Looper
import android.os.PowerManager
import android.view.Display
import androidx.glance.GlanceId
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.glance.appwidget.updateAll
import app.mannadev.meditation.BuildConfig
import app.mannadev.meditation.analytics.CrashlyticsHelper
import app.mannadev.meditation.di.getWidgetDependencies
import app.mannadev.meditation.ui.widget.QtWidgetLarge
import app.mannadev.meditation.ui.widget.QtWidgetSmall
import app.mannadev.meditation.ui.widget.VerseWidgetLarge
import app.mannadev.meditation.ui.widget.VerseWidgetSmall
import app.mannadev.meditation.widget.QtWidgetLargeReceiver
import app.mannadev.meditation.widget.QtWidgetSmallReceiver
import app.mannadev.meditation.widget.VerseWidgetLargeReceiver
import app.mannadev.meditation.widget.VerseWidgetSmallReceiver
import com.google.firebase.crashlytics.FirebaseCrashlytics
import kotlinx.coroutines.CancellationException
import timber.log.Timber
import java.io.File
import java.time.ZoneId
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors

/**
 * 위젯 갱신 경로 진단 로그([ISSUE-334]). 폴드 안쪽 화면 위젯만 이전 데이터로 남는 현상이 재발했을 때
 * "앱이 그 appWidgetId를 최신 데이터로 다시 그렸는가(RENDER) / 갱신 요청 대상에 그 ID가 있었는가
 * (UPDATE_ALL glanceIds vs systemIds) / 그때 화면이 접혀 있었는가(display)"를 사후에 확인한다.
 * 기록은 best-effort — 실패해도 호출부 동작(위젯 갱신/FCM 처리)에는 영향을 주지 않는다.
 * 메인 스레드(리시버 콜백, RN 모듈)에서 호출되면 파일 I/O는 전용 단일 스레드로 넘긴다. 이미 백그라운드인
 * 호출(FCM 핸들러, Glance 워커)은 그 자리에서 쓴다 — onMessageReceived 반환 직후 프로세스가 동결돼도 남도록.
 */
object WidgetDiagnostics {
    private const val TAG = "WidgetDiag"
    private const val LOG_FILE_NAME = "widget_diagnostics.log"
    private const val SNAPSHOT_PREFS = "widget_diagnostics"
    private const val CRASHLYTICS_LOG_BUDGET_CHARS = 60_000

    private val lock = Any()
    private val renderDedupe = RenderDedupe()
    private val ioExecutor = Executors.newSingleThreadExecutor { r -> Thread(r, "WidgetDiagnostics-IO") }

    /**
     * 디스크가 가득 차는 등 실패가 지속되면 이벤트마다 non-fatal이 쌓이므로 실패 지점(site)별로 프로세스당 한 번만
     * Crashlytics에 보낸다. 지점별로 나눠야 한 종류의 실패가 다른 종류(예: 파일 쓰기 실패)의 보고를 막지 않는다.
     */
    private val reportedFailureSites = ConcurrentHashMap.newKeySet<String>()

    /** Crashlytics 브레드크럼(세션당 64KB)은 핵심 이벤트만 — 나머지는 Timber + 파일로만 남긴다. */
    private val CRASHLYTICS_BREADCRUMB_EVENTS = setOf("FCM_RECEIVED", "FCM_HANDLED", "JS_PUSH", "RENDER_ERROR", "PERIODIC_SYNC_START")

    fun record(context: Context, event: String, vararg fields: Pair<String, Any?>) {
        write(context, event, fields.toList())
    }

    fun recordWithSnapshot(context: Context, snapshotKey: String, event: String, vararg fields: Pair<String, Any?>) {
        val entry = write(context, event, fields.toList()) ?: return
        runCatching {
            snapshotPrefs(context).edit().putString(snapshotKey, entry).apply()
        }.onFailure { e ->
            reportFailure(e, "snapshot", "WidgetDiagnostics: failed to save snapshot $snapshotKey")
        }
    }

    /**
     * `render_<id>`는 마지막 렌더(리포트를 보내려고 앱을 열 때의 렌더로 덮일 수 있음), `render_change_<id>`는
     * 그 ID의 데이터 요약이 마지막으로 바뀐 렌더다 — 리포트 흐름이 만든 렌더에 "언제 새 데이터로 바뀌었나"가 덮이지 않게 한다.
     * Data가 아닌 렌더(hasData=false — Loading/NoDataYet/Error)는 데이터 변경으로 치지 않는다 — 콜드 스타트의
     * Loading이나 일시적 Error 뒤에 같은 Data가 오면 "변경"으로 잡혀 render_change가 덮이는 것을 막는다.
     * appWidgetId를 알 수 없으면(-1) 줄만 남긴다 — 서로 다른 위젯이 같은 키로 섞이지 않게 dedupe/스냅샷에서 뺀다.
     */
    fun recordRender(context: Context, widget: String, appWidgetId: Int, summary: String, hasData: Boolean) {
        runCatching {
            val display = displaySummary(context)
            val fields = listOf("widget" to widget, "id" to appWidgetId, "data" to summary, "display" to display)
            if (appWidgetId < 0) {
                write(context, "RENDER", fields)
                return
            }
            if (!renderDedupe.shouldRecord(appWidgetId, "$summary|$display", System.currentTimeMillis())) return
            val entry = write(context, "RENDER", fields) ?: return
            val prefs = snapshotPrefs(context)
            val summaryKey = "render_summary_$appWidgetId"
            val editor = prefs.edit().putString("render_$appWidgetId", entry)
            if (hasData && prefs.getString(summaryKey, null) != summary) {
                editor.putString(summaryKey, summary).putString("render_change_$appWidgetId", entry)
            }
            editor.apply()
        }.onFailure { e ->
            reportFailure(e, "render_snapshot", "WidgetDiagnostics: failed to record render $appWidgetId")
        }
    }

    /** Glance가 알 수 없는 GlanceId를 주면 예외가 나므로 진단용 ID 조회가 렌더를 막지 않게 -1로 대체한다. */
    fun appWidgetIdOrUnknown(context: Context, id: GlanceId): Int =
        runCatching { GlanceAppWidgetManager(context).getAppWidgetId(id) }
            .getOrElse { e ->
                reportFailure(e, "resolve_app_widget_id", "WidgetDiagnostics: failed to resolve appWidgetId")
                -1
            }

    /** 진단 경로의 실패 보고. 실패가 지속돼도 Crashlytics non-fatal은 실패 지점(site)별로 프로세스당 한 번만 남긴다. */
    fun reportFailure(e: Throwable, site: String, message: String) {
        runCatching {
            if (reportedFailureSites.add(site)) {
                CrashlyticsHelper.recordException(e, message, tag = TAG)
            } else {
                Timber.tag(TAG).w(e, message)
            }
        }
    }

    /** 예: "d0(state=2,1856x2160) cfg=673x841dp" — 크기로 폴드 접힘/펼침을 구분한다. */
    fun displaySummary(context: Context): String = runCatching {
        val display = context.getSystemService(DisplayManager::class.java).getDisplay(Display.DEFAULT_DISPLAY)
        val config = context.resources.configuration
        "d0(state=${display?.state},${display?.mode?.physicalWidth}x${display?.mode?.physicalHeight}) " +
            "cfg=${config.screenWidthDp}x${config.screenHeightDp}dp"
    }.getOrElse { e -> "unavailable(${e.javaClass.simpleName})" }

    @Suppress("DEPRECATION") // Bundle.get(String): 키별 타입을 모르는 옵션 번들을 그대로 덤프하기 위함
    fun optionsSummary(options: Bundle): String = runCatching {
        WidgetDiagnosticsFormat.summarizeOptions(options.keySet().associateWith { options.get(it) })
    }.getOrElse { e -> "unavailable(${e.javaClass.simpleName})" }

    /**
     * 리포트를 Crashlytics non-fatal로 보내고 REPORT_MAX_CHARS로 자른 텍스트를 반환한다(네이티브 모듈이 클립보드에 복사).
     * 환경/스냅샷 섹션이 뒤에 오도록 구성했으므로 꼬리를 남겨도 그 섹션은 살아남는다.
     */
    fun sendReport(context: Context): String {
        check(Looper.myLooper() != Looper.getMainLooper()) { "sendReport must not run on the main thread" }
        val report = WidgetDiagnosticsFormat.tailWithinChars(buildReport(context).lines(), WidgetDiagnosticsFormat.REPORT_MAX_CHARS)
            .joinToString("\n")
        val crashlytics = FirebaseCrashlytics.getInstance()
        // Crashlytics 로그는 세션당 최근 64KB만 남는다 — 환경/스냅샷이 뒤에 오도록 리포트를 구성했으므로 꼬리를 보낸다.
        WidgetDiagnosticsFormat.tailWithinChars(report.lines(), CRASHLYTICS_LOG_BUDGET_CHARS)
            .forEach { crashlytics.log(it) }
        crashlytics.recordException(WidgetDiagnosticsReport("widget diagnostics report requested from developer menu"))
        return report
    }

    private fun write(context: Context, event: String, fields: List<Pair<String, Any?>>): String? = runCatching {
        val entry = WidgetDiagnosticsFormat.formatEntry(System.currentTimeMillis(), ZoneId.systemDefault(), event, fields)
        Timber.tag(TAG).d(entry)
        if (event in CRASHLYTICS_BREADCRUMB_EVENTS) FirebaseCrashlytics.getInstance().log(entry)
        if (WidgetDiagnosticsFormat.isPersisted(event)) {
            val file = logFile(context)
            if (Looper.myLooper() == Looper.getMainLooper()) {
                ioExecutor.execute { appendToFile(file, entry, event) }
            } else {
                appendToFile(file, entry, event)
            }
        }
        entry
    }.getOrElse { e ->
        reportFailure(e, "record", "WidgetDiagnostics: failed to record $event")
        null
    }

    private fun appendToFile(file: File, entry: String, event: String) {
        runCatching {
            synchronized(lock) {
                file.appendText(entry + "\n")
                if (file.length() > WidgetDiagnosticsFormat.TRIM_THRESHOLD_BYTES) {
                    val kept = WidgetDiagnosticsFormat.keepLastBytes(file.readLines(), WidgetDiagnosticsFormat.TRIM_TARGET_BYTES)
                    file.writeText(kept.joinToString("\n", postfix = "\n"))
                }
            }
        }.onFailure { e ->
            reportFailure(e, "file_write", "WidgetDiagnostics: failed to write $event")
        }
    }

    private fun buildReport(context: Context): String {
        // 메인 스레드에서 넘겨 둔 쓰기가 끝난 뒤 읽도록 같은 단일 스레드에서 읽는다(최신 줄 누락 방지).
        val lines = ioExecutor.submit<List<String>> {
            synchronized(lock) { logFile(context).takeIf { it.exists() }?.readLines().orEmpty() }
        }.get()
        // 메인 스레드 기록은 큐를 거쳐 늦게 쓰이므로 파일 순서가 시각 순서와 다를 수 있다 — 시각순으로 정렬한다.
        val selected = WidgetDiagnosticsFormat.sortByTime(WidgetDiagnosticsFormat.selectReportLines(lines, System.currentTimeMillis()))
        val compacted = WidgetDiagnosticsFormat.compactReportLines(selected)
        val snapshots = snapshotPrefs(context).all.toSortedMap().entries.joinToString("\n") { (k, v) -> "$k: $v" }
        return buildString {
            appendLine("=== widget diagnostics log (last 72h, oldest first, ${selected.size}/${lines.size} lines) ===")
            appendLine(
                "note: RENDER = composition committed for that appWidgetId; " +
                    "a following RENDER_ERROR for the same id means it was NOT published to the launcher.",
            )
            compacted.forEach { appendLine(it) }
            appendLine("=== last render / last data change (render_change) per widget id / last fcm per topic ===")
            appendLine(snapshots)
            // 섹션별로 격리 — 한 섹션이 실패해도 나머지 리포트는 보낸다.
            appendLine("=== current data ===")
            appendSection {
                val deps = getWidgetDependencies(context)
                "qt=${WidgetDiagnosticsFormat.summarizeState(deps.qtRepository().qtState.value) { it.date }}\n" +
                    "sermon=${WidgetDiagnosticsFormat.summarizeState(deps.sermonRepository().sermonState.value) {
                        WidgetDiagnosticsFormat.summarizeSermon(it.title, it.bookName, it.verses)
                    }}"
            }
            appendLine("=== placed widgets (id + options; sizes identify cover vs inner screen) ===")
            appendSection { placedWidgetsSummary(context) }
            appendLine("=== environment ===")
            appendLine("app=${BuildConfig.VERSION_NAME}(${BuildConfig.VERSION_CODE}) device=${Build.MANUFACTURER} ${Build.MODEL} sdk=${Build.VERSION.SDK_INT}")
            appendSection { environmentSummary(context) }
        }
    }

    private inline fun StringBuilder.appendSection(block: () -> String) {
        appendLine(runCatching(block).getOrElse { e -> "unavailable(${e.javaClass.simpleName})" })
    }

    private fun environmentSummary(context: Context): String {
        val usage = context.getSystemService(UsageStatsManager::class.java)
        val power = context.getSystemService(PowerManager::class.java)
        val displays = context.getSystemService(DisplayManager::class.java).displays
            .joinToString { "#${it.displayId}(state=${it.state},${it.mode.physicalWidth}x${it.mode.physicalHeight})" }
        return "standbyBucket=${usage.appStandbyBucket} " +
            "ignoringBatteryOpt=${power.isIgnoringBatteryOptimizations(context.packageName)} " +
            "powerSave=${power.isPowerSaveMode} deviceIdle=${power.isDeviceIdleMode} " +
            "displays=[$displays] now=${displaySummary(context)}"
    }

    private fun placedWidgetsSummary(context: Context): String {
        val manager = AppWidgetManager.getInstance(context)
        return RECEIVERS.joinToString("\n") { receiver ->
            val ids = manager.getAppWidgetIds(ComponentName(context, receiver))
            val perId = ids.joinToString("; ") { id -> "$id ${optionsSummary(manager.getAppWidgetOptions(id))}" }
            "${receiver.simpleName}: ids=${ids.toList()} $perId"
        }
    }

    private fun logFile(context: Context) = File(context.applicationContext.filesDir, LOG_FILE_NAME)

    private fun snapshotPrefs(context: Context) =
        context.applicationContext.getSharedPreferences(SNAPSHOT_PREFS, Context.MODE_PRIVATE)

    internal fun receiverFor(widget: GlanceAppWidget): Class<*>? = when (widget) {
        is VerseWidgetSmall -> VerseWidgetSmallReceiver::class.java
        is VerseWidgetLarge -> VerseWidgetLargeReceiver::class.java
        is QtWidgetSmall -> QtWidgetSmallReceiver::class.java
        is QtWidgetLarge -> QtWidgetLargeReceiver::class.java
        else -> null
    }

    private val RECEIVERS = listOf(
        VerseWidgetSmallReceiver::class.java,
        VerseWidgetLargeReceiver::class.java,
        QtWidgetSmallReceiver::class.java,
        QtWidgetLargeReceiver::class.java,
    )
}

/** Crashlytics에서 진단 리포트 이벤트를 구분하기 위한 마커 예외. */
class WidgetDiagnosticsReport(message: String) : Exception(message)

/**
 * `updateAll` 전에 "Glance가 아는 ID(glanceIds)"와 "시스템에 배치된 ID(systemIds)"를 함께 기록한다.
 * 두 목록이 다르면 Glance 쪽에서 특정 위젯 인스턴스가 갱신 대상에서 빠진 것이다.
 */
suspend fun GlanceAppWidget.updateAllLogged(context: Context, reason: String) {
    try {
        val glanceManager = GlanceAppWidgetManager(context)
        val glanceIds = try {
            glanceManager.getGlanceIds(javaClass).map { glanceManager.getAppWidgetId(it) }
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            listOf("error:${e.javaClass.simpleName}")
        }
        val systemIds = WidgetDiagnostics.receiverFor(this)?.let { receiver ->
            AppWidgetManager.getInstance(context).getAppWidgetIds(ComponentName(context, receiver)).toList()
        }
        // 배치된 위젯이 없는 종류의 UPDATE_ALL은 잡음이므로 기록하지 않는다(updateAll은 항상 호출).
        if (glanceIds.isNotEmpty() || !systemIds.isNullOrEmpty()) {
            WidgetDiagnostics.record(
                context, "UPDATE_ALL",
                "widget" to javaClass.simpleName, "reason" to reason,
                "glanceIds" to glanceIds, "systemIds" to systemIds, "display" to WidgetDiagnostics.displaySummary(context),
            )
        }
    } catch (e: CancellationException) {
        throw e
    } catch (e: Throwable) {
        WidgetDiagnostics.reportFailure(e, "update_all", "WidgetDiagnostics: failed to log UPDATE_ALL for ${javaClass.simpleName}")
    }
    updateAll(context)
}
