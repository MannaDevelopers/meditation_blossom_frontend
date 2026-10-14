package app.mannadev.meditation.widget.diagnostics

import android.app.usage.UsageStatsManager
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.hardware.display.DisplayManager
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.view.Display
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

/**
 * 위젯 갱신 경로 진단 로그([ISSUE-334]). 폴드 안쪽 화면 위젯만 이전 데이터로 남는 현상이 재발했을 때
 * "앱이 그 appWidgetId를 최신 데이터로 다시 그렸는가(RENDER) / 갱신 요청 대상에 그 ID가 있었는가
 * (UPDATE_ALL glanceIds vs systemIds) / 그때 화면이 접혀 있었는가(display)"를 사후에 확인한다.
 * 기록은 best-effort — 실패해도 호출부 동작(위젯 갱신/FCM 처리)에는 영향을 주지 않는다.
 */
object WidgetDiagnostics {
    private const val TAG = "WidgetDiag"
    private const val LOG_FILE_NAME = "widget_diagnostics.log"
    private const val SNAPSHOT_PREFS = "widget_diagnostics"
    private const val CRASHLYTICS_LOG_BUDGET_CHARS = 60_000

    private val lock = Any()
    private val renderDedupe = RenderDedupe()

    fun record(context: Context, event: String, vararg fields: Pair<String, Any?>) {
        write(context, event, fields.toList())
    }

    fun recordWithSnapshot(context: Context, snapshotKey: String, event: String, vararg fields: Pair<String, Any?>) {
        val entry = write(context, event, fields.toList()) ?: return
        runCatching {
            snapshotPrefs(context).edit().putString(snapshotKey, entry).apply()
        }.onFailure { e ->
            CrashlyticsHelper.recordException(e, "WidgetDiagnostics: failed to save snapshot $snapshotKey", tag = TAG)
        }
    }

    fun recordRender(context: Context, widget: String, appWidgetId: Int, summary: String) {
        if (!renderDedupe.shouldRecord(appWidgetId, summary, System.currentTimeMillis())) return
        recordWithSnapshot(
            context, "render_$appWidgetId", "RENDER",
            "widget" to widget, "id" to appWidgetId, "data" to summary, "display" to displaySummary(context),
        )
    }

    /** 예: "d0(state=2,1856x2160) cfg=673x841dp" — 크기로 폴드 접힘/펼침을 구분한다. */
    fun displaySummary(context: Context): String = runCatching {
        val display = context.getSystemService(DisplayManager::class.java).getDisplay(Display.DEFAULT_DISPLAY)
        val config = context.resources.configuration
        "d0(state=${display?.state},${display?.mode?.physicalWidth}x${display?.mode?.physicalHeight}) " +
            "cfg=${config.screenWidthDp}x${config.screenHeightDp}dp"
    }.getOrElse { e -> "unavailable(${e.javaClass.simpleName})" }

    @Suppress("DEPRECATION") // Bundle.get(String): 키별 타입을 모르는 옵션 번들을 그대로 덤프하기 위함
    fun optionsSummary(options: Bundle): String =
        WidgetDiagnosticsFormat.summarizeOptions(options.keySet().associateWith { options.get(it) })

    /** 리포트를 Crashlytics non-fatal로 보내고 같은 텍스트를 반환한다(개발자 메뉴에서 클립보드 복사용). */
    fun sendReport(context: Context): String {
        val report = buildReport(context)
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
        FirebaseCrashlytics.getInstance().log(entry)
        synchronized(lock) {
            val file = logFile(context)
            file.appendText(entry + "\n")
            if (file.length() > WidgetDiagnosticsFormat.TRIM_THRESHOLD_BYTES) {
                val kept = WidgetDiagnosticsFormat.keepLastLines(file.readLines(), WidgetDiagnosticsFormat.MAX_LOG_LINES)
                file.writeText(kept.joinToString("\n", postfix = "\n"))
            }
        }
        entry
    }.getOrElse { e ->
        CrashlyticsHelper.recordException(e, "WidgetDiagnostics: failed to record $event", tag = TAG)
        null
    }

    private fun buildReport(context: Context): String {
        val lines = synchronized(lock) {
            logFile(context).takeIf { it.exists() }?.readLines().orEmpty()
        }
        val selected = WidgetDiagnosticsFormat.selectReportLines(lines, System.currentTimeMillis())
        val snapshots = snapshotPrefs(context).all.toSortedMap().entries.joinToString("\n") { (k, v) -> "$k: $v" }
        val deps = getWidgetDependencies(context)
        return buildString {
            appendLine("=== widget diagnostics log (last 72h, oldest first, ${selected.size}/${lines.size} lines) ===")
            selected.forEach { appendLine(it) }
            appendLine("=== last render per widget id / last fcm per topic ===")
            appendLine(snapshots)
            appendLine("=== current data ===")
            appendLine("qt=${WidgetDiagnosticsFormat.summarizeState(deps.qtRepository().qtState.value) { it.date }}")
            appendLine("sermon=${WidgetDiagnosticsFormat.summarizeState(deps.sermonRepository().sermonState.value) { it.title }}")
            appendLine("=== placed widgets (id + options; sizes identify cover vs inner screen) ===")
            appendLine(placedWidgetsSummary(context))
            appendLine("=== environment ===")
            appendLine("app=${BuildConfig.VERSION_NAME}(${BuildConfig.VERSION_CODE}) device=${Build.MANUFACTURER} ${Build.MODEL} sdk=${Build.VERSION.SDK_INT}")
            appendLine(environmentSummary(context))
        }
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
        WidgetDiagnostics.record(
            context, "UPDATE_ALL",
            "widget" to javaClass.simpleName, "reason" to reason,
            "glanceIds" to glanceIds, "systemIds" to systemIds, "display" to WidgetDiagnostics.displaySummary(context),
        )
    } catch (e: CancellationException) {
        throw e
    } catch (e: Throwable) {
        CrashlyticsHelper.recordException(e, "WidgetDiagnostics: failed to log UPDATE_ALL for ${javaClass.simpleName}", tag = "WidgetDiag")
    }
    updateAll(context)
}
