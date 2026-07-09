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
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope

/**
 * Sermon/QT 원격 동기화를 실행하고 성공/실패를 [Result]로 감싼다.
 * [WidgetInitialSyncWorker]/[WidgetPeriodicSyncWorker] 양쪽에서 공유하며,
 * 순수 람다만 받으므로 Hilt 없이도 단위 테스트 가능하다.
 *
 * 두 동기화는 서로 다른 Firestore 컬렉션을 다루고 의존 관계가 없으므로,
 * 한쪽이 실패해도 다른 쪽이 항상 시도되도록 각각 독립적으로(runCatching)
 * 병렬 실행한다. 성공은 둘 다 성공했을 때만이며, 실패 시 설교 쪽 예외를
 * 우선한다(결정적 동작을 위해).
 */
suspend fun runWidgetSync(
    syncSermon: suspend () -> Unit,
    syncQt: suspend () -> Unit,
): Result<Unit> = coroutineScope {
    val sermonResult = async { runCatching { syncSermon() } }
    val qtResult = async { runCatching { syncQt() } }
    listOf(sermonResult.await(), qtResult.await())
        .firstNotNullOfOrNull { it.exceptionOrNull() }
        ?.let { Result.failure(it) }
        ?: Result.success(Unit)
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
