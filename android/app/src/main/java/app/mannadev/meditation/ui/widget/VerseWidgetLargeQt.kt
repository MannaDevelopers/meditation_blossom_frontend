package app.mannadev.meditation.ui.widget

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.action.actionStartActivity
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.appWidgetBackground
import androidx.glance.appwidget.lazy.LazyColumn
import androidx.glance.appwidget.lazy.items
import androidx.glance.appwidget.provideContent
import androidx.glance.layout.Alignment
import androidx.glance.layout.Column
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import app.mannadev.meditation.MainActivity
import app.mannadev.meditation.R
import app.mannadev.meditation.analytics.CrashlyticsHelper
import app.mannadev.meditation.di.getWidgetDependencies
import app.mannadev.meditation.dto.SermonDto
import app.mannadev.meditation.model.Sermon
import app.mannadev.meditation.ui.widget.theme.Typography
import timber.log.Timber

class VerseWidgetLargeQt : GlanceAppWidget(
    errorUiLayout = R.layout.verse_widget_qt_large_error,
) {
    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val dependencies = getWidgetDependencies(context)
        val getDisplayQtUseCase = dependencies.getDisplayQtUseCase()
        val qt = getDisplayQtUseCase() ?: run {
            Timber.w("VerseWidgetLargeQt: No QT data, using error fallback")
            CrashlyticsHelper.recordException(
                IllegalStateException("VerseWidgetLargeQt: getDisplayQtUseCase returned null"),
                "QT widget displayed error fallback due to missing data"
            )
            null
        }
        val verse = qt?.let {
            Sermon.fromDto(
                SermonDto(
                    date = it.date,
                    title = if (it.seriesTitle.isNotBlank()) "${it.seriesTitle} / ${it.title}" else it.title,
                    content = it.content,
                    dayOfWeek = it.dayOfWeek,
                )
            )
        } ?: Sermon.errorSermon

        provideContent { VerseWidgetLargeQtContent(verse) }
    }
}

private object VerseLargeQtDimens {
    val appBarVerticalPadding = 24.dp
    val horizontalPadding = 24.dp
    val bottomPadding = 24.dp
    val verseContentBottomSpacer = 16.dp
    val bookNameTopSpacer = 12.dp
}

@Composable
private fun VerseWidgetLargeQtContent(sermon: Sermon) {
    Column(
        modifier = GlanceModifier
            .fillMaxSize()
            .clickable(actionStartActivity<MainActivity>())
            .appWidgetBackground()
            .xmlGradientBackground(),
        horizontalAlignment = Alignment.Start,
        verticalAlignment = Alignment.Top
    ) {
        Column(
            modifier = GlanceModifier.padding(
                horizontal = VerseLargeQtDimens.horizontalPadding,
                vertical = VerseLargeQtDimens.appBarVerticalPadding,
            ),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = sermon.title,
                style = Typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                maxLines = 2,
            )
        }
        LazyColumn(GlanceModifier.fillMaxWidth().defaultWeight()) {
            items(sermon.verses) { verse ->
                Text(
                    modifier = GlanceModifier
                        .fillMaxWidth()
                        .padding(horizontal = VerseLargeQtDimens.horizontalPadding)
                        .clickable(actionStartActivity<MainActivity>()),
                    text = verse,
                    style = Typography.titleMedium.copy(fontWeight = FontWeight.Normal),
                )
            }
            item { Spacer(GlanceModifier.height(VerseLargeQtDimens.verseContentBottomSpacer)) }
        }
        Text(
            modifier = GlanceModifier.padding(
                start = VerseLargeQtDimens.horizontalPadding,
                top = VerseLargeQtDimens.bookNameTopSpacer,
                bottom = VerseLargeQtDimens.bottomPadding,
            ),
            text = sermon.bookName,
            style = Typography.labelMedium,
        )
    }
}
