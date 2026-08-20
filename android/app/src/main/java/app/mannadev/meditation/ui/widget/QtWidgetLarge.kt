package app.mannadev.meditation.ui.widget

import android.content.Context
import android.graphics.Bitmap
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.unit.dp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.ImageProvider
import androidx.glance.LocalContext
import androidx.glance.LocalSize
import androidx.glance.action.Action
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.appWidgetBackground
import androidx.glance.appwidget.lazy.LazyColumn
import androidx.glance.appwidget.lazy.items
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.compose.ui.graphics.Color as ComposeColor
import app.mannadev.meditation.Constants
import app.mannadev.meditation.R
import app.mannadev.meditation.analytics.CrashlyticsHelper
import app.mannadev.meditation.data.hasAppEverLaunched
import app.mannadev.meditation.di.getWidgetDependencies
import app.mannadev.meditation.dto.WidgetDesignDto
import app.mannadev.meditation.ui.widget.qt.QtWidgetUiModel
import app.mannadev.meditation.ui.widget.qt.prefixQuestions
import app.mannadev.meditation.ui.widget.theme.Typography
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlin.math.roundToInt

class QtWidgetLarge : GlanceAppWidget(
    errorUiLayout = R.layout.verse_widget_qt_large_error,
) {
    // VerseWidgetLarge.kt와 동일한 이유([#233]) — 갤러리 배경이 위젯 리사이즈 시 실제 렌더링
    // 크기를 반영해 다시 구워지도록 SizeMode.Single 대신 Exact를 쓴다.
    override val sizeMode = SizeMode.Exact

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val qtRepository = getWidgetDependencies(context).qtRepository()
        val youtubeLinkEnabled = getWidgetDependencies(context).getWidgetPrefs().isEnabled()
        val qtWidgetDesignRepository = getWidgetDependencies(context).qtWidgetDesignRepository()
        provideContent {
            val state by qtRepository.qtState.collectAsState()
            val design by qtWidgetDesignRepository.designState.collectAsState()
            val uiModel = state.toDisplayQtUiModel(hasAppEverLaunched(context))
            val clickAction = widgetClickAction(uiModel.videoUrl, Constants.DEEP_LINK_DAILY_MANNA)
            QtWidgetLargeContent(uiModel, clickAction, youtubeLinkEnabled, design)
        }
    }

    override fun onCompositionError(
        context: Context,
        glanceId: GlanceId,
        appWidgetId: Int,
        throwable: Throwable,
    ) {
        CrashlyticsHelper.recordException(throwable, "QtWidgetLarge: uncaught composition error")
        super.onCompositionError(context, glanceId, appWidgetId, throwable)
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
private fun QtWidgetLargeContent(
    ui: QtWidgetUiModel,
    clickAction: Action,
    youtubeLinkEnabled: Boolean,
    design: WidgetDesignDto?,
) {
    // 갤러리 배경은 VerseWidgetLarge.kt와 동일한 방식(cover-fit + 포커스 포인트, 위젯 실제
    // 렌더링 크기 기준)으로 매번 다시 구워 그린다([ISSUE-236] 후속: QT 위젯도 저장된 디자인을
    // 실제로 반영).
    val glanceSize = LocalSize.current
    val density = LocalContext.current.resources.displayMetrics.density
    val widthPx = (glanceSize.width.value * density).roundToInt()
    val heightPx = (glanceSize.height.value * density).roundToInt()
    val galleryBitmap by produceState<Bitmap?>(
        initialValue = null,
        design?.background?.type,
        design?.background?.value,
        design?.background?.imageTransform,
        widthPx,
        heightPx,
    ) {
        value = if (design?.background?.type == "gallery" && widthPx > 0 && heightPx > 0) {
            withContext(Dispatchers.IO) {
                decodeGalleryBitmap(design.background.value, design.background.imageTransform, widthPx, heightPx)
            }
        } else {
            null
        }
    }

    val baseModifier = GlanceModifier
        .fillMaxSize()
        .clickable(clickAction)
        .appWidgetBackground()
    val backgroundModifier = when {
        design == null -> baseModifier.xmlGradientBackground()
        design.background.type == "gallery" && galleryBitmap != null ->
            baseModifier.background(ImageProvider(galleryBitmap!!))
        design.background.type == "gallery" -> baseModifier.xmlGradientBackground() // 디코딩 대기/실패 폴백
        design.background.value == "gradient-default" -> baseModifier.xmlGradientBackground()
        else -> baseModifier.background(ComposeColor(android.graphics.Color.parseColor(design.background.value)))
    }
    val titleStyle = design?.text?.toTitleTextStyle(FontWeight.Bold)
        ?: Typography.titleMedium.copy(fontWeight = FontWeight.Bold)
    val bodyStyle = design?.text?.toBodyTextStyle() ?: Typography.titleMedium.copy(fontWeight = FontWeight.Normal)
    val labelStyle = design?.text?.toIndexTextStyle(BANNER_INDEX_SIZE_RATIO) ?: Typography.labelSmall

    Column(
        modifier = backgroundModifier,
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
                    style = labelStyle,
                )
                Spacer(GlanceModifier.height(VerseLargeQtDimens.dateLabelBottomGap))
            }
            Row(
                modifier = GlanceModifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    modifier = GlanceModifier.defaultWeight(),
                    text = ui.title,
                    style = titleStyle,
                    maxLines = 2,
                )
                if (youtubeLinkEnabled) {
                    Spacer(GlanceModifier.width(6.dp))
                    YoutubeMarker()
                }
            }
        }
        LazyColumn(GlanceModifier.fillMaxWidth().defaultWeight()) {
            if (ui.reference.isNotBlank()) {
                item {
                    Text(
                        modifier = GlanceModifier
                            .padding(horizontal = VerseLargeQtDimens.horizontalPadding)
                            .clickable(clickAction),
                        text = ui.reference,
                        style = labelStyle,
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
                    style = bodyStyle,
                )
            }
            if (ui.questions.isNotEmpty()) {
                val prefixed = prefixQuestions(ui.questions)
                item { Spacer(GlanceModifier.height(VerseLargeQtDimens.sectionGap)) }
                item {
                    Text(
                        modifier = GlanceModifier
                            .padding(horizontal = VerseLargeQtDimens.horizontalPadding)
                            .clickable(clickAction),
                        text = "묵상 질문",
                        style = labelStyle,
                    )
                }
                item { Spacer(GlanceModifier.height(VerseLargeQtDimens.sectionInnerGap)) }
                items(prefixed) { question ->
                    Text(
                        modifier = GlanceModifier
                            .fillMaxWidth()
                            .padding(horizontal = VerseLargeQtDimens.horizontalPadding)
                            .clickable(clickAction),
                        text = question,
                        style = bodyStyle,
                    )
                }
            }
            item { Spacer(GlanceModifier.height(VerseLargeQtDimens.bottomPadding)) }
        }
    }
}
