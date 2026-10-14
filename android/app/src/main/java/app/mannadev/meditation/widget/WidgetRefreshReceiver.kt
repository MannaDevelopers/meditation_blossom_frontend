package app.mannadev.meditation.widget

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import app.mannadev.meditation.analytics.AnalyticsHelper
import app.mannadev.meditation.analytics.CrashlyticsHelper
import app.mannadev.meditation.ui.widget.QtWidgetLarge
import app.mannadev.meditation.ui.widget.QtWidgetSmall
import app.mannadev.meditation.ui.widget.VerseWidgetLarge
import app.mannadev.meditation.ui.widget.VerseWidgetSmall
import app.mannadev.meditation.widget.diagnostics.updateAllLogged
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * 날짜/시간/시간대가 바뀌거나(매니페스트 등록), 화면이 켜지거나 잠금이 풀리거나 폴드가 펼쳐질 때
 * (Application에서 동적 등록 — [registerWidgetRefreshReceiver]) 4종 위젯을 다시 그린다([ISSUE-331]).
 *
 * 위젯의 날짜 표시는 렌더링 시점에 계산되므로, `updatePeriodMillis`(30분) 갱신이 접힌 폴드의 안쪽 화면
 * 홈처럼 비활성 호스트에서 지연/누락되면 전날 날짜가 남는다. 이 Receiver가 그 공백을 메운다.
 */
class WidgetRefreshReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action !in REFRESH_ACTIONS) return
        val appContext = context.applicationContext
        val pending = goAsync()
        scope.launch {
            try {
                refreshAllWidgets(appContext, intent.action.orEmpty())
            } finally {
                pending.finish()
            }
        }
    }

    companion object {
        /** 매니페스트로도 수신 가능한 암시적 브로드캐스트(날짜/시간 변경). */
        val MANIFEST_ACTIONS = setOf(
            Intent.ACTION_DATE_CHANGED,
            Intent.ACTION_TIME_CHANGED,
            Intent.ACTION_TIMEZONE_CHANGED,
        )

        /** 매니페스트 수신이 불가해 프로세스 생존 중에만 동적으로 받는 액션. */
        val DYNAMIC_ACTIONS = setOf(
            Intent.ACTION_USER_PRESENT,
            Intent.ACTION_SCREEN_ON,
            Intent.ACTION_CONFIGURATION_CHANGED,
        )

        val REFRESH_ACTIONS: Set<String> = MANIFEST_ACTIONS + DYNAMIC_ACTIONS

        private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    }
}

suspend fun refreshAllWidgets(context: Context, reason: String) {
    runCatching {
        VerseWidgetLarge().updateAllLogged(context, "refresh_$reason")
        VerseWidgetSmall().updateAllLogged(context, "refresh_$reason")
        QtWidgetLarge().updateAllLogged(context, "refresh_$reason")
        QtWidgetSmall().updateAllLogged(context, "refresh_$reason")
        AnalyticsHelper.logWidgetUpdated("refresh_$reason")
    }.onFailure { e ->
        CrashlyticsHelper.recordException(e, "WidgetRefreshReceiver: failed to refresh widgets ($reason)")
    }
}

/**
 * 매니페스트로 받을 수 없는 액션(화면 켜짐/잠금 해제/구성 변경)을 앱 프로세스가 살아 있는 동안 수신한다.
 * 폴드를 펼쳐 위젯이 있는 홈을 볼 때 즉시 갱신하기 위한 보조 경로다.
 */
fun registerWidgetRefreshReceiver(context: Context) {
    val filter = android.content.IntentFilter().apply {
        WidgetRefreshReceiver.DYNAMIC_ACTIONS.forEach { addAction(it) }
    }
    context.registerReceiver(WidgetRefreshReceiver(), filter, Context.RECEIVER_NOT_EXPORTED)
}
