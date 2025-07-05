package app.mannadev.meditation.ui.widget

import android.content.Context
import androidx.glance.GlanceId
import androidx.glance.action.ActionParameters
import androidx.glance.appwidget.action.ActionCallback
import androidx.glance.appwidget.state.updateAppWidgetState
import androidx.glance.state.PreferencesGlanceStateDefinition
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.workDataOf
import app.mannadev.meditation.data.SermonDataSource
import app.mannadev.meditation.di.DataSourceEntryPoint
import dagger.hilt.android.EntryPointAccessors

class RefreshActionCallback : ActionCallback {

    companion object {
        private const val WORK_NAME = "widgetDataSync"
        const val KEY_TARGET_DATE = "target_date"
    }

    override suspend fun onAction(
        context: Context,
        glanceId: GlanceId,
        parameters: ActionParameters
    ) {
        //Loading 상태로 업데이트
        updateAppWidgetState(context, PreferencesGlanceStateDefinition, glanceId) {
            it.toMutablePreferences().apply {
                this[VerseWidgetDataKeys.state] = "LOADING"
            }
        }
        VerseWidgetLarge().update(context, glanceId)

        // Get SermonLocalDataSource from Hilt
        val hiltEntryPoint = EntryPointAccessors.fromApplication(
            context.applicationContext, DataSourceEntryPoint::class.java
        )
        val sermonLocalDataSource: SermonDataSource = hiltEntryPoint.getSermonLocalDataSource()
        val sermonDto = sermonLocalDataSource.getDisplaySermon()


        //Sqlite에서 조회한 것도 만료된 데이터일 경우 firestore에서 최신 데이터 조회
        val workRequest = OneTimeWorkRequestBuilder<SermonDataSyncWorker>()
            .setInputData(
                workDataOf(SermonDataSyncWorker.KEY_GLANCE_ID to glanceId.toString())
            )
            .build()

        WorkManager.getInstance(context)
            .enqueueUniqueWork(
                uniqueWorkName = WORK_NAME,
                existingWorkPolicy = androidx.work.ExistingWorkPolicy.REPLACE,
                request = workRequest
            )

    }
}