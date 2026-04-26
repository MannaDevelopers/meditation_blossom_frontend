package app.mannadev.meditation.ui.widget

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.action.Action
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
import app.mannadev.meditation.R
import app.mannadev.meditation.analytics.CrashlyticsHelper
import app.mannadev.meditation.di.getWidgetDependencies
import app.mannadev.meditation.ui.widget.qt.QtWidgetUiModel
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
        val uiModel = qt?.let(QtWidgetUiModel::fromDto) ?: QtWidgetUiModel.error
        val clickAction = widgetClickAction(uiModel.videoUrl)

        provideContent { VerseWidgetLargeQtContent(uiModel, clickAction) }
    }
}

private object VerseLargeQtDimens {
    val appBarVerticalPadding = 12.dp
    val horizontalPadding = 24.dp
    val bottomPadding = 24.dp
    val sectionGap = 16.dp
    val sectionInnerGap = 8.dp
    val dateLabelBottomGap = 4.dp
    val dateLabelStartPadding = 4.dp
}

@Composable
private fun VerseWidgetLargeQtContent(ui: QtWidgetUiModel, clickAction: Action) {
    Column(
        modifier = GlanceModifier
            .fillMaxSize()
            .clickable(clickAction)
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
        ) {
            if (ui.dateLabel.isNotBlank()) {
                Text(
                    modifier = GlanceModifier.padding(start = VerseLargeQtDimens.dateLabelStartPadding),
                    text = ui.dateLabel,
                    style = Typography.labelSmall,
                )
                Spacer(GlanceModifier.height(VerseLargeQtDimens.dateLabelBottomGap))
            }
            Text(
                text = ui.title,
                style = Typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                maxLines = 2,
            )
        }
        LazyColumn(GlanceModifier.fillMaxWidth().defaultWeight()) {
            if (ui.reference.isNotBlank()) {
                item {
                    Text(
                        modifier = GlanceModifier.padding(horizontal = VerseLargeQtDimens.horizontalPadding),
                        text = ui.reference,
                        style = Typography.labelMedium,
                    )
                }
            }
            item { Spacer(GlanceModifier.height(VerseLargeQtDimens.sectionInnerGap)) }
            items(ui.verses) { verse ->
                Text(
                    modifier = GlanceModifier
                        .fillMaxWidth()
                        .padding(horizontal = VerseLargeQtDimens.horizontalPadding)
                        .clickable(clickAction),
                    text = verse,
                    style = Typography.titleMedium.copy(fontWeight = FontWeight.Normal),
                )
            }
            if (ui.questions.isNotEmpty()) {
                val numberedQuestions = ui.questions.mapIndexed { index, q -> "${index + 1}. $q" }
                item { Spacer(GlanceModifier.height(VerseLargeQtDimens.sectionGap)) }
                item {
                    Text(
                        modifier = GlanceModifier.padding(horizontal = VerseLargeQtDimens.horizontalPadding),
                        text = "묵상 질문",
                        style = Typography.labelMedium,
                    )
                }
                item { Spacer(GlanceModifier.height(VerseLargeQtDimens.sectionInnerGap)) }
                items(numberedQuestions) { numbered ->
                    Text(
                        modifier = GlanceModifier
                            .fillMaxWidth()
                            .padding(horizontal = VerseLargeQtDimens.horizontalPadding)
                            .clickable(clickAction),
                        text = numbered,
                        style = Typography.titleMedium.copy(fontWeight = FontWeight.Normal),
                    )
                }
            }
            item { Spacer(GlanceModifier.height(VerseLargeQtDimens.bottomPadding)) }
        }
    }
}
