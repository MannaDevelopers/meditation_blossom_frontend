package app.mannadev.meditation.ui.widget

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import app.mannadev.meditation.data.SermonDataSource
import javax.inject.Inject


class SermonDataSyncWorker @Inject constructor(
    context: Context,
    workerParams: WorkerParameters,
    private val dataSource: SermonDataSource
) : CoroutineWorker(context, workerParams) {

    companion object {
        const val KEY_GLANCE_ID = "glance_id"
    }

    override suspend fun doWork(): Result {
        dataSource.getDisplaySermon()
    }
}