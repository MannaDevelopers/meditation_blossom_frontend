package app.mannadev.meditation.widget

import android.content.Context
import androidx.glance.appwidget.updateAll
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
import app.mannadev.meditation.ui.widget.QtWidgetLarge
import app.mannadev.meditation.ui.widget.QtWidgetSmall
import app.mannadev.meditation.ui.widget.VerseWidgetLarge
import app.mannadev.meditation.ui.widget.VerseWidgetSmall
import java.util.concurrent.TimeUnit

/**
 * 위젯이 (메인 앱을 한 번도 열지 않은 채) 처음 추가됐을 때, prefs가 비어있으면
 * `provideGlance()` 내부의 동기적 Firestore fallback이 실패하거나(느린 네트워크,
 * 콜드 스타트 타임아웃 등) 시간이 걸릴 수 있다. 이 Worker는 그 fallback과 별개로
 * 동작하는 백업 경로로, WorkManager의 재시도/네트워크 대기를 이용해 데이터가
 * 준비되는 즉시(또는 재시도 끝에) 위젯을 다시 그린다.
 *
 * [GetDisplaySermonUseCase]/[GetDisplayQtUseCase]를 호출하는 것 자체가 prefs가
 * 비어있을 때 Firestore 조회 + prefs 저장까지 수행하므로, 이 Worker는 그 결과를
 * 이용해 [updateAll]만 호출하면 된다.
 */
class WidgetInitialSyncWorker(
    context: Context,
    workerParams: WorkerParameters,
) : CoroutineWorker(context, workerParams) {

    companion object {
        const val WORK_NAME = "widget_initial_sync"
    }

    override suspend fun doWork(): Result {
        return try {
            val dependencies = getWidgetDependencies(applicationContext)
            dependencies.getDisplaySermonUseCase()()
            dependencies.getDisplayQtUseCase()()

            VerseWidgetLarge().updateAll(applicationContext)
            VerseWidgetSmall().updateAll(applicationContext)
            QtWidgetLarge().updateAll(applicationContext)
            QtWidgetSmall().updateAll(applicationContext)

            Result.success()
        } catch (e: Exception) {
            CrashlyticsHelper.recordException(e, "WidgetInitialSyncWorker failed")
            Result.retry()
        }
    }
}

/**
 * 위젯이 추가될 때(각 Receiver의 onEnabled) 호출한다. 여러 위젯이 동시에 추가돼도
 * [ExistingWorkPolicy.KEEP]으로 중복 Firestore 조회를 막는다. 네트워크가 연결된
 * 뒤에만 실행되고, 실패 시 지수 백오프로 재시도한다.
 */
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
