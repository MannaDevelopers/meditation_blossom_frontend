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
    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val sermonRepository = getWidgetDependencies(context).sermonRepository()
        val youtubeLinkEnabled = getWidgetDependencies(context).getWidgetPrefs().isEnabled()
        val widgetDesignRepository = getWidgetDependencies(context).widgetDesignRepository()
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

// 카드형(Small) 갤러리 배경 위 제목 영역에 덮는 반투명 흰색 "액자" 틴트의 불투명도.
// src/components/WidgetPreview.tsx의 CARD_PHOTO_BORDER_TINT_OPACITY(0.55)와 동일.
private const val CARD_PHOTO_TITLE_TINT_OPACITY = 0.55f
// src/utils/widgetDesignColor.ts의 cardOuterTint 기본 delta(22)와 동일.
private const val CARD_BACKGROUND_LIGHTEN_DELTA = 22f

/**
 * 카드형(Small) 위젯의 이중 레이어 재해석([#169] 3.7절, src/components/WidgetPreview.tsx CardPreview와
 * 동일 규칙):
 * - 배경색: 제목 영역(바깥 Column)은 본문 카드(안쪽 Column)보다 밝은(또는 이미 밝으면 더 어두운)
 *   동일 색조 톤을 쓴다.
 * - 배경 갤러리: 사진을 바깥 Column 배경 전체에 깔고, 안쪽 카드는 배경을 비워 사진이 그대로
 *   선명하게 보이게 한다. 제목 Row에만 반투명 흰색을 덮어 "액자"처럼 구분한다 — RN은 SVG 마스크로
 *   테두리 전체(도넛 모양)를 덮지만, Glance는 임의 형태 마스킹을 지원하지 않아 가장 눈에 띄는
 *   제목 영역만 근사한다(테두리 좌우/하단 여백은 사진이 그대로 보임).
 */
@Composable
private fun VerseWidgetSmallContent(
    sermon: Sermon,
    clickAction: Action,
    youtubeLinkEnabled: Boolean,
    design: WidgetDesignDto?,
) {
    val isGallery = design?.background?.type == "gallery"
    // 갤러리 배경은 위젯이 "지금 실제로 렌더링되는 크기"(LocalSize, 리사이즈하면 바뀜) 기준으로
    // 매번 cover-fit + 포커스 포인트를 다시 계산해 구운 뒤 그린다 — VerseWidgetLarge.kt와 동일한
    // 이유([#233], 고정 해상도로 구우면 리사이즈 시 사진이 크롭되지 않고 늘어나 보임).
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
            innerModifier = GlanceModifier // 배경 없음 — 바깥 사진이 그대로 비쳐 보인다.
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
    val titleRowModifier = if (isGallery && galleryBitmap != null) {
        GlanceModifier.background(Color.White.copy(alpha = CARD_PHOTO_TITLE_TINT_OPACITY))
    } else {
        GlanceModifier
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
            modifier = titleRowModifier
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
