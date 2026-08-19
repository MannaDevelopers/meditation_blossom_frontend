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
import androidx.glance.appwidget.lazy.items
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
import app.mannadev.meditation.Constants
import app.mannadev.meditation.R
import app.mannadev.meditation.analytics.CrashlyticsHelper
import app.mannadev.meditation.data.hasAppEverLaunched
import app.mannadev.meditation.di.getWidgetDependencies
import app.mannadev.meditation.dto.WidgetDesignDto
import app.mannadev.meditation.model.Sermon
import app.mannadev.meditation.ui.widget.theme.Typography
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlin.math.roundToInt

class VerseWidgetSmall : GlanceAppWidget(
    errorUiLayout = R.layout.verse_widget_small_error,
) {
    // 기본값(SizeMode.Single)은 위젯이 처음 배치될 때의 minWidth/minHeight 기준 크기 하나만
    // 고정으로 제공해, 사용자가 홈 화면에서 위젯을 리사이즈해도 LocalSize.current가 그 변화를
    // 반영하지 않는다 — 갤러리 배경 cover-fit 크기 계산([#233])이 항상 배치 당시 크기 기준으로
    // 굳어 있던 원인. Exact로 바꿔 실제 렌더링 크기가 바뀔 때마다 재컴포지션되게 한다.
    override val sizeMode = SizeMode.Exact

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val sermonRepository = getWidgetDependencies(context).sermonRepository()
        val youtubeLinkEnabled = getWidgetDependencies(context).getWidgetPrefs().isEnabled()
        val widgetDesignRepository = getWidgetDependencies(context).sermonWidgetDesignRepository()
        provideContent {
            val state by sermonRepository.sermonState.collectAsState()
            val design by widgetDesignRepository.designState.collectAsState()
            val sermon = state.toDisplaySermon(hasAppEverLaunched(context))
            val clickAction = widgetClickAction(sermon.videoUrl, Constants.DEEP_LINK_SUNDAY_SERMON)
            VerseWidgetSmallContent(sermon, clickAction, youtubeLinkEnabled, design)
        }
    }

    override fun onCompositionError(
        context: Context,
        glanceId: GlanceId,
        appWidgetId: Int,
        throwable: Throwable,
    ) {
        CrashlyticsHelper.recordException(throwable, "VerseWidgetSmall: uncaught composition error")
        super.onCompositionError(context, glanceId, appWidgetId, throwable)
    }
}

private object VerseSmallWidgetDimens {
    val appBarVerticalPadding = 20.dp
    val horizontalPadding = 24.dp
    val bookNameTopSpacer = 8.dp
    val contentBackgroundRadius = 16.dp
    val contentPadding = 12.dp
    val widgetPadding = 12.dp
    val verseItemSpacing = 4.dp
}

// 카드형(Small) 갤러리 배경의 "액자"(도넛 마스크) 영역에 덮는 반투명 흰색의 불투명도.
// src/components/WidgetPreview.tsx의 CARD_PHOTO_BORDER_TINT_OPACITY(0.55)와 동일.
private const val CARD_PHOTO_FRAME_TINT_OPACITY = 0.55f
// src/utils/widgetDesignColor.ts의 cardOuterTint 기본 delta(22)와 동일.
private const val CARD_BACKGROUND_LIGHTEN_DELTA = 22f
// 제목 Row 높이를 실제 텍스트 줄바꿈 없이 근사하기 위한 예상 줄 수(최대 2줄 중 평균치) —
// produceState는 Compose가 텍스트를 실제로 레이아웃하기 전에 마스크를 구워야 해서, 정확한
// 렌더 높이 대신 이 근사치를 쓴다(제목이 1줄이면 마스크 구멍 위쪽에 약간의 여백 오차가 남는다).
private const val CARD_TITLE_ESTIMATED_LINES = 1.6f
private const val CARD_TITLE_LINE_HEIGHT_RATIO = 1.3f

/**
 * 카드형(Small) 위젯의 이중 레이어 재해석([#169] 3.7절, src/components/WidgetPreview.tsx CardPreview와
 * 동일 규칙):
 * - 배경색: 제목 영역(바깥 Column)은 본문 카드(안쪽 Column)보다 밝은(또는 이미 밝으면 더 어두운)
 *   동일 색조 톤을 쓴다.
 * - 배경 갤러리: 사진을 바깥 Column 배경 전체에 깔고, 안쪽 카드 자리만 비워 사진이 그대로
 *   선명하게 보이게 한다. RN의 SVG 도넛 마스크(CardPhotoFrame)와 동일하게, Glance는 배경
 *   자체에 마스크를 구워 넣는 [decodeGalleryCardBitmap]으로 이 효과를 낸다.
 */
@Composable
private fun VerseWidgetSmallContent(
    sermon: Sermon,
    clickAction: Action,
    youtubeLinkEnabled: Boolean,
    design: WidgetDesignDto?,
) {
    // 갤러리 배경은 위젯이 "지금 실제로 렌더링되는 크기"(LocalSize, 리사이즈하면 바뀜) 기준으로
    // 매번 cover-fit + 포커스 포인트를 다시 계산해 구운 뒤 그린다 — VerseWidgetLarge.kt와 동일한
    // 이유([#233], 고정 해상도로 구우면 리사이즈 시 사진이 크롭되지 않고 늘어나 보임).
    val glanceSize = LocalSize.current
    val density = LocalContext.current.resources.displayMetrics.density
    val widthPx = (glanceSize.width.value * density).roundToInt()
    val heightPx = (glanceSize.height.value * density).roundToInt()
    val marginPx = VerseSmallWidgetDimens.widgetPadding.value * density
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
                VerseSmallWidgetDimens.appBarVerticalPadding.value * 2 +
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
                    outerCornerRadius = 0f, // 바깥 모서리는 appWidgetBackground()의 시스템 클리핑에 맡긴다.
                    innerCornerRadius = VerseSmallWidgetDimens.contentBackgroundRadius.value * density,
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
            innerModifier = GlanceModifier // 배경 없음 — 마스크 구멍으로 바깥 사진이 그대로 비쳐 보인다.
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
    val bookNameStyle = design?.text?.toIndexTextStyle(CARD_INDEX_SIZE_RATIO) ?: Typography.labelSmall

    Column(
        modifier = outerModifier,
        horizontalAlignment = Alignment.Start,
        verticalAlignment = Alignment.Top
    ) {
        Row(
            modifier = GlanceModifier
                .fillMaxWidth()
                .padding(
                    horizontal = VerseSmallWidgetDimens.horizontalPadding,
                    vertical = VerseSmallWidgetDimens.appBarVerticalPadding
                ),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                modifier = GlanceModifier.defaultWeight(),
                text = sermon.title,
                style = titleStyle,
                maxLines = 2
            )
            if (youtubeLinkEnabled) {
                Spacer(GlanceModifier.width(6.dp))
                YoutubeMarker()
            }
        }
        Box(
            GlanceModifier
                .padding(horizontal = VerseSmallWidgetDimens.widgetPadding)
                .padding(bottom = VerseSmallWidgetDimens.widgetPadding)
                .defaultWeight()
                .fillMaxWidth()
        ) {
            Column(
                innerModifier
                    .cornerRadius(VerseSmallWidgetDimens.contentBackgroundRadius)
                    .fillMaxSize()
            ) {
                LazyColumn(
                    GlanceModifier.defaultWeight().fillMaxWidth()
                ) {
                    item {
                        Spacer(GlanceModifier.height(VerseSmallWidgetDimens.contentPadding))
                    }
                    items(sermon.verses) { verse ->
                        Text(
                            modifier = GlanceModifier
                                .fillMaxWidth()
                                .padding(horizontal = VerseSmallWidgetDimens.contentPadding)
                                .padding(bottom = VerseSmallWidgetDimens.verseItemSpacing)
                                .clickable(clickAction),
                            text = verse,
                            style = bodyStyle,
                        )
                    }
                    item {
                        Spacer(GlanceModifier.height(VerseSmallWidgetDimens.contentPadding))
                    }
                }
                Text(
                    modifier = GlanceModifier.padding(
                        top = VerseSmallWidgetDimens.bookNameTopSpacer,
                        start = VerseSmallWidgetDimens.contentPadding,
                        bottom = VerseSmallWidgetDimens.contentPadding
                    ),
                    text = sermon.bookName,
                    style = bookNameStyle,
                )
            }
        }
    }
}

//@OptIn(ExperimentalGlancePreviewApi::class)
//@Preview(widthDp = 200, heightDp = 300)
//@Composable
//private fun VerseWidgetSmallPreview() {
//    val verseDto = VerseDto(
//        title = "2. 회심에 대하여(고백록)",
//        content = "본문 : 로마서 13:11-14 11 또한 너희가 이 시기를 알거니와 자다가 깰 때가 벌써 되었으니 이는 이제 우리의 구원이 처음 믿을 때보다 가까웠음이라 12 밤이 깊고 낮이 가까웠으니 그러므로 우리가 어둠의 일을 벗고 빛의 갑옷을 입자 13 낮에와 같이 단정히 행하고 방탕하거나 술 취하지 말며 음란하거나 호색하지 말며 다투거나 시기하지 말고 14 오직 주 예수 그리스도로 옷 입고 정욕을 위하여 육신의 일을 도모하지 말라",
//        date = "2025-05-25",
//        dayOfWeek = "SUN"
//    )
//    val verse = Verse(
//        bookName = "로마서 13:11-14",
//        contents = listOf(
//            "11 또한 너희가 이 시기를 알거니와 자다가 깰 때가 벌써 되었으니 이는 이제 우리의 구원이 처음 믿을 때보다 가까웠음이라",
//            "12 밤이 깊고 낮이 가까웠으니 그러므로 우리가 어둠의 일을 벗고 빛의 갑옷을 입자",
//            "13 낮에와 같이 단정히 행하고 방탕하거나 술 취하지 말며 음란하거나 호색하지 말며 다투거나 시기하지 말고",
//            "14 오직 주 예수 그리스도로 옷 입고 정욕을 위하여 육신의 일을 도모하지 말라"
//        ),
//    )
//
//    GlanceTheme {
//        VerseWidgetSmallContent(verse)
//    }
//}
