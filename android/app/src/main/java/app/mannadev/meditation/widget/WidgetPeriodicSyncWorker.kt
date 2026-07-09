package app.mannadev.meditation.widget

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import app.mannadev.meditation.analytics.CrashlyticsHelper
import app.mannadev.meditation.di.getWidgetDependencies
import java.util.concurrent.TimeUnit

/**
 * FCM push가 누락됐을 때를 대비한 하루 1회 안전망. 설교(주 1회)/QT(일 1회) 갱신
 * 주기상 실시간성이 필요 없으므로 배터리 영향을 최소화하기 위해 1일 간격으로 둔다.
 */
class WidgetPeriodicSyncWorker(
    context: Context,
    workerParams: WorkerParameters,
) : CoroutineWorker(context, workerParams) {

    companion object {
        const val WORK_NAME = "widget_periodic_sync"
    }

    override suspend fun doWork(): Result {
        val dependencies = getWidgetDependencies(applicationContext)
        val result = runWidgetSync(
            syncSermon = { dependencies.sermonRepository().syncFromRemote() },
            syncQt = { dependencies.qtRepository().syncFromRemote() },
        )
        return result.fold(
            onSuccess = { Result.success() },
            onFailure = { e ->
                CrashlyticsHelper.recordException(e, "WidgetPeriodicSyncWorker failed")
                Result.retry()
            },
        )
    }
}

fun enqueueWidgetPeriodicSync(context: Context) {
    val request = PeriodicWorkRequestBuilder<WidgetPeriodicSyncWorker>(1, TimeUnit.DAYS)
        .setConstraints(
            Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build(),
        )
        .build()

    WorkManager.getInstance(context)
        .enqueueUniquePeriodicWork(
            WidgetPeriodicSyncWorker.WORK_NAME,
            ExistingPeriodicWorkPolicy.KEEP,
            request,
        )
}
