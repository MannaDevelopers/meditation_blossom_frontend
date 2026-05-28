package app.mannadev.meditation.ui.widget

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.core.net.toUri
import androidx.glance.GlanceId
import androidx.glance.action.ActionParameters
import androidx.glance.action.actionParametersOf
import androidx.glance.appwidget.action.ActionCallback
import app.mannadev.meditation.Constants.FALLBACK_YOUTUBE_URL
import app.mannadev.meditation.MainActivity
import app.mannadev.meditation.analytics.AnalyticsHelper
import app.mannadev.meditation.analytics.CrashlyticsHelper
import app.mannadev.meditation.di.getWidgetDependencies

class YoutubeLinkClickAction : ActionCallback {
    override suspend fun onAction(
        context: Context,
        glanceId: GlanceId,
        parameters: ActionParameters,
    ) {
        val intent = runCatching {
            val enabled = getWidgetDependencies(context).getWidgetPrefs().isEnabled()
            val deepLinkUrl = parameters[DEEP_LINK_URL]
            if (enabled) {
                val videoUrl = parameters[VIDEO_URL]
                val target: Uri = videoUrl?.takeIf { it.isNotBlank() }?.toUri()
                    ?: FALLBACK_YOUTUBE_URL.toUri()
                AnalyticsHelper.logWidgetClicked("youtube", deepLinkUrl)
                Intent(Intent.ACTION_VIEW, target)
            } else {
                val target: Uri? = deepLinkUrl?.takeIf { it.isNotBlank() }?.toUri()
                AnalyticsHelper.logWidgetClicked("main_app", deepLinkUrl)
                Intent(Intent.ACTION_VIEW, target ?: return@runCatching Intent(context, MainActivity::class.java))
            }
        }.getOrElse { e ->
            CrashlyticsHelper.recordException(e, "YoutubeLinkClickAction: fallback to app launch")
            Intent(context, MainActivity::class.java)
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
    }

    companion object {
        val VIDEO_URL: ActionParameters.Key<String> = ActionParameters.Key("video_url")
        val DEEP_LINK_URL: ActionParameters.Key<String> = ActionParameters.Key("deep_link_url")

        fun params(videoUrl: String?, deepLinkUrl: String): ActionParameters =
            if (videoUrl?.isNotBlank() == true) {
                actionParametersOf(DEEP_LINK_URL to deepLinkUrl, VIDEO_URL to videoUrl)
            } else {
                actionParametersOf(DEEP_LINK_URL to deepLinkUrl)
            }
    }
}
