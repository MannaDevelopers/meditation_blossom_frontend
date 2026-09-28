package app.mannadev.meditation.widget

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import app.mannadev.meditation.analytics.CrashlyticsHelper
import app.mannadev.meditation.data.WeeklySermons
import app.mannadev.meditation.data.WorshipSetting
import app.mannadev.meditation.di.getWidgetDependencies

/**
 * 위젯이 주기적으로(30분 간격, `updatePeriodMillis`) 다시 그려질 때마다 함께 실행되어, FCM
 * 수신 시점엔 예배 시각이 안 돼서 반영이 보류됐던 sermons-v2 이벤트를 실제 시각이 지난 뒤
 * 뒤늦게라도 반영한다([ISSUE-315]). 이미 로컬에 캐시된 `weekly_sermons`만 다시 확인하므로
 * 네트워크 호출은 없다 — `WidgetInitialSyncWorker`/`WidgetPeriodicSyncWorker`(원격 동기화)와는
 * 목적이 다르다.
 */
class WorshipBoundaryWorker(
    context: Context,
    workerParams: WorkerParameters,
) : CoroutineWorker(context, workerParams) {

    companion object {
        const val WORK_NAME = "worship_boundary_reconcile"
    }

    override suspend fun doWork(): Result {
        return try {
            reconcileWorshipBoundary(applicationContext)
            Result.success()
        } catch (e: Exception) {
            CrashlyticsHelper.recordException(e, "WorshipBoundaryWorker failed")
            // 네트워크가 필요 없는 로컬 작업이라 재시도해도 원인이 바뀌지 않을 가능성이 높다 —
            // 다음 위젯 갱신 주기(30분)에 다시 시도되므로 여기서 재시도하지 않는다.
            Result.failure()
        }
    }
}

/**
 * '전체' 설정이면 sermons-v2는 상관이 없으므로([#303]와 동일 규칙) 건너뛴다. 캐시에 설정과
 * 일치하고 예배 시각이 지난 항목이 있으면 SermonRepository에 반영해 위젯이 갱신되게 한다.
 */
private suspend fun reconcileWorshipBoundary(context: Context) {
    val dependencies = getWidgetDependencies(context)
    val setting = WorshipSetting.resolve(dependencies.asyncStorage().get(WorshipSetting.ASYNC_STORAGE_KEY))
    if (setting == WorshipSetting.ALL) return

    val weeklyJson = dependencies.asyncStorage().get(WeeklySermons.ASYNC_STORAGE_WEEKLY_SERMONS) ?: return
    val entry = WeeklySermons.findArrivedEntry(weeklyJson, setting) ?: return

    dependencies.sermonRepository().save(WeeklySermons.cacheEntryToSermonDto(entry))
}

fun enqueueWorshipBoundaryCheck(context: Context) {
    val request = OneTimeWorkRequestBuilder<WorshipBoundaryWorker>().build()
    WorkManager.getInstance(context)
        .enqueueUniqueWork(WorshipBoundaryWorker.WORK_NAME, ExistingWorkPolicy.REPLACE, request)
}
