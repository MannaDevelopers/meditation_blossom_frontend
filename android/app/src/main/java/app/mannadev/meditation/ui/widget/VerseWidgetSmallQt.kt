package app.mannadev.meditation.ui.widget

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.action.actionStartActivity
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.appWidgetBackground
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.lazy.LazyColumn
import androidx.glance.appwidget.lazy.items
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.text.Text
import app.mannadev.meditation.MainActivity
import app.mannadev.meditation.R
import app.mannadev.meditation.analytics.CrashlyticsHelper
import app.mannadev.meditation.di.getWidgetDependencies
import app.mannadev.meditation.dto.SermonDto
import app.mannadev.meditation.model.Sermon
import app.mannadev.meditation.ui.widget.theme.Typography
import timber.log.Timber

class VerseWidgetSmallQt : GlanceAppWidget(
    errorUiLayout = R.layout.verse_widget_qt_small_error,
) {
    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val dependencies = getWidgetDependencies(context)
        val getDisplayQtUseCase = dependencies.getDisplayQtUseCase()
        val qt = getDisplayQtUseCase() ?: run {
            Timber.w("VerseWidgetSmallQt: No QT data, using error fallback")
            CrashlyticsHelper.recordException(
                IllegalStateException("VerseWidgetSmallQt: getDisplayQtUseCase returned null"),
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

        provideContent { VerseWidgetSmallQtContent(verse) }
    }
}

private object VerseSmallQtDimens {
    val appBarVerticalPadding = 20.dp
    val horizontalPadding = 24.dp
    val bookNameTopSpacer = 8.dp
    val contentBackgroundRadius = 16.dp
    val contentPadding = 12.dp
    val widgetPadding = 12.dp
}

@Composable
private fun VerseWidgetSmallQtContent(sermon: Sermon) {
    Column(
        modifier = GlanceModifier
            .fillMaxSize()
            .clickable(actionStartActivity<MainActivity>())
            .appWidgetBackground()
            .background(Color.White),
        horizontalAlignment = Alignment.Start,
        verticalAlignment = Alignment.Top
    ) {
        Text(
            modifier = GlanceModifier.padding(
                horizontal = VerseSmallQtDimens.horizontalPadding,
                vertical = VerseSmallQtDimens.appBarVerticalPadding,
            ),
            text = sermon.title,
            style = Typography.titleMedium,
            maxLines = 2,
        )
        Box(
            GlanceModifier
                .padding(horizontal = VerseSmallQtDimens.widgetPadding)
                .padding(bottom = VerseSmallQtDimens.widgetPadding)
                .defaultWeight()
                .fillMaxWidth()
        ) {
            Column(
                GlanceModifier
                    .cornerRadius(VerseSmallQtDimens.contentBackgroundRadius)
                    .xmlGradientBackground()
                    .fillMaxSize()
            ) {
                LazyColumn(GlanceModifier.defaultWeight().fillMaxWidth()) {
                    item { Spacer(GlanceModifier.height(VerseSmallQtDimens.contentPadding)) }
                    items(sermon.verses) { verse ->
                        Text(
                            modifier = GlanceModifier
                                .fillMaxWidth()
                                .padding(horizontal = VerseSmallQtDimens.contentPadding)
                                .clickable(actionStartActivity<MainActivity>()),
                            text = verse,
                            style = Typography.bodyMedium,
                        )
                    }
                    item { Spacer(GlanceModifier.height(VerseSmallQtDimens.contentPadding)) }
                }
                Text(
                    modifier = GlanceModifier.padding(
                        top = VerseSmallQtDimens.bookNameTopSpacer,
                        start = VerseSmallQtDimens.contentPadding,
                        bottom = VerseSmallQtDimens.contentPadding,
                    ),
                    text = sermon.bookName,
                    style = Typography.labelSmall,
                )
            }
        }
    }
}
