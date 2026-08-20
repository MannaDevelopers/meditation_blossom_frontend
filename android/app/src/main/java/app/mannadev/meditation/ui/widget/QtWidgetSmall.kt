package app.mannadev.meditation.ui.widget

import android.content.Context
import android.graphics.Bitmap
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.graphics.Color
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
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.lazy.LazyColumn
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
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
import androidx.glance.unit.ColorProvider
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

class QtWidgetSmall : GlanceAppWidget(
    errorUiLayout = R.layout.verse_widget_qt_small_error,
) {
    // VerseWidgetSmall.kt와 동일한 이유([#233]) — 갤러리 배경이 위젯 리사이즈 시 실제 렌더링
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
            QtWidgetSmallContent(uiModel, clickAction, youtubeLinkEnabled, design)
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

// VerseWidgetSmall.kt의 카드형(Small) 이중 레이어 규칙과 동일한 상수·근사치 — 제목 줄바꿈을
// 실제로 레이아웃하기 전에 갤러리 마스크를 구워야 해서 근사 높이를 쓴다.
private const val CARD_PHOTO_FRAME_TINT_OPACITY = 0.55f
private const val CARD_BACKGROUND_LIGHTEN_DELTA = 22f
private const val CARD_TITLE_ESTIMATED_LINES = 1.3f
private const val CARD_TITLE_LINE_HEIGHT_RATIO = 1.3f

@Composable
private fun QtWidgetSmallContent(
    ui: QtWidgetUiModel,
    clickAction: Action,
    youtubeLinkEnabled: Boolean,
    design: WidgetDesignDto?,
) {
    // 갤러리 배경은 VerseWidgetSmall.kt와 동일한 방식(도넛 마스크로 안쪽 카드 자리만 비움)으로
    // 매번 다시 구워 그린다([ISSUE-236] 후속: QT 위젯도 저장된 디자인을 실제로 반영).
    val glanceSize = LocalSize.current
    val density = LocalContext.current.resources.displayMetrics.density
    val widthPx = (glanceSize.width.value * density).roundToInt()
    val heightPx = (glanceSize.height.value * density).roundToInt()
    val marginPx = VerseSmallQtDimens.widgetPadding.value * density
    val galleryBitmap by produceState<Bitmap?>(
        initialValue = null,
        design?.background?.type,
        design?.background?.value,
        design?.background?.imageTransform,
        design?.text?.size,
        widthPx,
        heightPx,
    ) {
        value = if (design?.background?.type == "gallery" && widthPx > 0 && heightPx > 0) {
            val titleHeightPx = (
                VerseSmallQtDimens.appBarVerticalPadding.value * 2 +
                    design.text.size * CARD_TITLE_LINE_HEIGHT_RATIO * CARD_TITLE_ESTIMATED_LINES
                ) * density
            withContext(Dispatchers.IO) {
                decodeGalleryCardBitmap(
                    design.background.value,
                    design.background.imageTransform,
                    widthPx,
                    heightPx,
                    innerLeft = marginPx,
                    innerTop = titleHeightPx,
                    innerRight = widthPx - marginPx,
                    innerBottom = heightPx - marginPx,
                    outerCornerRadius = 0f,
                    innerCornerRadius = VerseSmallQtDimens.contentBackgroundRadius.value * density,
                    tintOpacity = CARD_PHOTO_FRAME_TINT_OPACITY,
                )
            }
        } else {
            null
        }
    }

    val outerBase = GlanceModifier.fillMaxSize().clickable(clickAction).appWidgetBackground()
    val outerModifier: GlanceModifier
    val innerModifier: GlanceModifier
    when {
        design == null -> {
            outerModifier = outerBase.background(Color.White)
            innerModifier = GlanceModifier.xmlGradientBackground()
        }
        design.background.type == "gallery" && galleryBitmap != null -> {
            outerModifier = outerBase.background(ImageProvider(galleryBitmap!!))
            innerModifier = GlanceModifier
        }
        design.background.type == "gallery" -> { // 디코딩 대기/실패 폴백
            outerModifier = outerBase.background(Color.White)
            innerModifier = GlanceModifier.xmlGradientBackground()
        }
        design.background.value == "gradient-default" -> {
            outerModifier = outerBase.background(Color.White)
            innerModifier = GlanceModifier.xmlGradientBackground()
        }
        else -> {
            val solidColor = Color(android.graphics.Color.parseColor(design.background.value))
            outerModifier = outerBase.background(
                cardOuterTintColor(design.background.value, CARD_BACKGROUND_LIGHTEN_DELTA)
            )
            innerModifier = GlanceModifier.background(solidColor)
        }
    }
    val titleStyle = design?.text?.toTitleTextStyle(FontWeight.Medium) ?: Typography.titleMedium
    val bodyStyle = design?.text?.toBodyTextStyle() ?: Typography.bodyMedium
    val labelStyle = design?.text?.toIndexTextStyle(CARD_INDEX_SIZE_RATIO) ?: Typography.labelSmall
    val dividerColor = design?.text?.let { ColorProvider(Color(android.graphics.Color.parseColor(it.color)).copy(alpha = 0.2f)) }
        ?: ColorProvider(Color(0x33000000))

    Column(
        modifier = outerModifier,
        horizontalAlignment = Alignment.Start,
        verticalAlignment = Alignment.Top
    ) {
        Row(
            modifier = GlanceModifier
                .fillMaxWidth()
                .padding(
                    horizontal = VerseSmallQtDimens.horizontalPadding,
                    vertical = VerseSmallQtDimens.appBarVerticalPadding,
                ),
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
        Box(
            GlanceModifier
                .padding(horizontal = VerseSmallQtDimens.widgetPadding)
                .padding(bottom = VerseSmallQtDimens.widgetPadding)
                .defaultWeight()
                .fillMaxWidth()
        ) {
            LazyColumn(
                innerModifier
                    .cornerRadius(VerseSmallQtDimens.contentBackgroundRadius)
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
                            style = labelStyle,
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
                        style = bodyStyle,
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
                                    .background(dividerColor)
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
                            style = labelStyle,
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
                                style = bodyStyle,
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
