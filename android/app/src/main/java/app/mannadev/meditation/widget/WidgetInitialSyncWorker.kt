package app.mannadev.meditation.widget

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import app.mannadev.meditation.analytics.CrashlyticsHelper
import app.mannadev.meditation.di.getWidgetDependencies
import java.util.concurrent.TimeUnit

/**
 * Sermon/QT 원격 동기화를 실행하고 성공/실패를 [Result]로 감싼다.
 * [WidgetInitialSyncWorker]/[WidgetPeriodicSyncWorker] 양쪽에서 공유하며,
 * 순수 람다만 받으므로 Hilt 없이도 단위 테스트 가능하다.
 */
suspend fun runWidgetSync(
    syncSermon: suspend () -> Unit,
    syncQt: suspend () -> Unit,
): kotlin.Result<Unit> = runCatching {
    syncSermon()
    syncQt()
}

class WidgetInitialSyncWorker(
    context: Context,
    workerParams: WorkerParameters,
) : CoroutineWorker(context, workerParams) {

    companion object {
        const val WORK_NAME = "widget_initial_sync"
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
                CrashlyticsHelper.recordException(e, "WidgetInitialSyncWorker failed")
                Result.retry()
            },
        )
    }
}

fun enqueueWidgetInitialSync(context: Context) {
    val request = OneTimeWorkRequestBuilder<WidgetInitialSyncWorker>()
        .setConstraints(
            Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build(),
        )
        .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
        .build()

    WorkManager.getInstance(context)
        .enqueueUniqueWork(
            WidgetInitialSyncWorker.WORK_NAME,
            ExistingWorkPolicy.KEEP,
            request,
        )
}
