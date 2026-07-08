package app.mannadev.meditation.ui.widget

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.action.Action
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.appWidgetBackground
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.lazy.LazyColumn
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
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import app.mannadev.meditation.Constants
import app.mannadev.meditation.R
import app.mannadev.meditation.analytics.CrashlyticsHelper
import app.mannadev.meditation.di.getWidgetDependencies
import app.mannadev.meditation.ui.widget.qt.QtWidgetUiModel
import app.mannadev.meditation.ui.widget.qt.prefixQuestions
import app.mannadev.meditation.ui.widget.theme.Typography

class QtWidgetSmall : GlanceAppWidget(
    errorUiLayout = R.layout.verse_widget_qt_small_error,
) {
    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val qtRepository = getWidgetDependencies(context).qtRepository()
        provideContent {
            val state by qtRepository.qtState.collectAsState()
            val uiModel = state.toDisplayQtUiModel()
            val clickAction = widgetClickAction(uiModel.videoUrl, Constants.DEEP_LINK_DAILY_MANNA)
            QtWidgetSmallContent(uiModel, clickAction)
        }
    }

    override fun onCompositionError(
        context: Context,
        glanceId: GlanceId,
        appWidgetId: Int,
        throwable: Throwable,
    ) {
        CrashlyticsHelper.recordException(throwable, "QtWidgetSmall: uncaught composition error")
        super.onCompositionError(context, glanceId, appWidgetId, throwable)
    }
}

private object VerseSmallQtDimens {
    val appBarVerticalPadding = 20.dp
    val horizontalPadding = 24.dp
    val contentBackgroundRadius = 16.dp
    val contentPadding = 12.dp
    val widgetPadding = 12.dp
    val sectionGap = 8.dp
    val dividerHeight = 1.dp
}

@Composable
private fun QtWidgetSmallContent(ui: QtWidgetUiModel, clickAction: Action) {
    Column(
        modifier = GlanceModifier
            .fillMaxSize()
            .clickable(clickAction)
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
            text = ui.title,
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
            LazyColumn(
                GlanceModifier
                    .cornerRadius(VerseSmallQtDimens.contentBackgroundRadius)
                    .xmlGradientBackground()
                    .fillMaxSize()
            ) {
                item { Spacer(GlanceModifier.height(VerseSmallQtDimens.contentPadding)) }
                
                if (ui.reference.isNotBlank()) {
                    item {
                        Text(
                            modifier = GlanceModifier
                                .padding(horizontal = VerseSmallQtDimens.contentPadding)
                                .clickable(clickAction),
                            text = ui.reference,
                            style = Typography.labelSmall,
                        )
                    }
                    item { Spacer(GlanceModifier.height(VerseSmallQtDimens.sectionGap)) }
                }
                item {
                    Text(
                        modifier = GlanceModifier
                            .padding(horizontal = VerseSmallQtDimens.contentPadding)
                            .clickable(clickAction),
                        text = ui.verses.joinToString(" "),
                        style = Typography.bodyMedium,
                    )
                }
                if (ui.questions.isNotEmpty()) {
                    val prefixed = prefixQuestions(ui.questions)
                    item { Spacer(GlanceModifier.height(VerseSmallQtDimens.sectionGap)) }
                    item {
                        Box(
                            GlanceModifier
                                .fillMaxWidth()
                                .padding(horizontal = VerseSmallQtDimens.contentPadding)
                        ) {
                            Box(
                                GlanceModifier
                                    .fillMaxWidth()
                                    .height(VerseSmallQtDimens.dividerHeight)
                                    .background(ColorProvider(Color(0x33000000)))
                            ) {}
                        }
                    }
                    item { Spacer(GlanceModifier.height(VerseSmallQtDimens.sectionGap)) }
                    item {
                        Text(
                            modifier = GlanceModifier
                                .padding(horizontal = VerseSmallQtDimens.contentPadding)
                                .clickable(clickAction),
                            text = "묵상 질문",
                            style = Typography.labelSmall,
                        )
                    }
                    item { Spacer(GlanceModifier.height(VerseSmallQtDimens.sectionGap)) }

                    prefixed.forEachIndexed { index, question ->
                        item {
                            Text(
                                modifier = GlanceModifier
                                    .padding(horizontal = VerseSmallQtDimens.contentPadding)
                                    .clickable(clickAction),
                                text = question,
                                style = Typography.bodyMedium,
                            )
                        }
                        if (index < prefixed.size - 1) {
                            item { Spacer(GlanceModifier.height(VerseSmallQtDimens.sectionGap)) }
                        }
                    }
                }
                
                item { Spacer(GlanceModifier.height(VerseSmallQtDimens.contentPadding)) }
            }
        }
    }
}
