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
import app.mannadev.meditation.model.Sermon
import app.mannadev.meditation.ui.widget.theme.Typography
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlin.math.roundToInt

class VerseWidgetLarge : GlanceAppWidget(
    errorUiLayout = R.layout.verse_widget_large_error,
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
            VerseWidgetLargeContent(sermon, clickAction, youtubeLinkEnabled, design)
        }
    }

    override fun onCompositionError(
        context: Context,
        glanceId: GlanceId,
        appWidgetId: Int,
        throwable: Throwable,
    ) {
        CrashlyticsHelper.recordException(throwable, "VerseWidgetLarge: uncaught composition error")
        super.onCompositionError(context, glanceId, appWidgetId, throwable)
    }
}

private object VerseLargeWidgetDimens {
    val appBarVerticalPadding = 24.dp
    val horizontalPadding = 24.dp
    val bottomPadding = 24.dp
    val verseContentBottomSpacer = 16.dp
    val verseItemSpacing = 4.dp
    val bookNameTopSpacer = 12.dp
}

/**
 * Composable function that defines the content of the large verse widget.
 * It displays the verse title, content (scrollable if it exceeds the available space), and book name.
 * The widget has a gradient background and is clickable to open the MainActivity.
 *
 * @param sermon The [Sermon] object containing the data to be displayed.
 * @param design 저장된 위젯 디자인(EditScreen에서 편집). null이면 편집 기능 도입 이전과 동일한
 *   하드코딩 스타일을 그대로 쓴다(=DEFAULT_WIDGET_DESIGN과 값이 같음).
 */
@Composable
private fun VerseWidgetLargeContent(
    sermon: Sermon,
    clickAction: Action,
    youtubeLinkEnabled: Boolean,
    design: WidgetDesignDto?,
) {
    // 갤러리 배경은 위젯이 "지금 실제로 렌더링되는 크기"(LocalSize, 리사이즈하면 바뀜) 기준으로
    // 매번 cover-fit + 포커스 포인트를 다시 계산해 구운 뒤 그린다. 예전처럼 고정 해상도 비트맵
    // 하나를 구워 Glance 기본 배경 늘림(stretch)에 맡기면, 위젯을 리사이즈할 때 사진이 크롭
    // 범위만 바뀌는 게 아니라 통째로 늘어나거나 줄어드는 문제가 있었다([#233]).
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
    val bookNameStyle = design?.text?.toIndexTextStyle(BANNER_INDEX_SIZE_RATIO) ?: Typography.labelMedium

    Column(
        modifier = backgroundModifier,
        horizontalAlignment = Alignment.Start,
        verticalAlignment = Alignment.Top
    ) {
        // Title Section
        Column(
            modifier = GlanceModifier
                .padding(
                    horizontal = VerseLargeWidgetDimens.horizontalPadding,
                    vertical = VerseLargeWidgetDimens.appBarVerticalPadding
                ),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                modifier = GlanceModifier.fillMaxWidth(),
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
        }
        // Content and Book Name Section
        LazyColumn(
            GlanceModifier.fillMaxWidth()
                .defaultWeight()
        ) {
            items(sermon.verses) { verse ->
                Text(
                    modifier = GlanceModifier
                        .fillMaxWidth()
                        .padding(horizontal = VerseLargeWidgetDimens.horizontalPadding)
                        .padding(bottom = VerseLargeWidgetDimens.verseItemSpacing)
                        .clickable(clickAction),
                    text = verse,
                    style = bodyStyle,
                )
            }
            item {
                Spacer(GlanceModifier.height(VerseLargeWidgetDimens.verseContentBottomSpacer)) // 마지막 항목 아래 여백
            }
        }
        Text(
            modifier = GlanceModifier.padding(
                start = VerseLargeWidgetDimens.horizontalPadding,
                top = VerseLargeWidgetDimens.bookNameTopSpacer,
                bottom = VerseLargeWidgetDimens.bottomPadding
            ),
            text = sermon.bookName,
            style = bookNameStyle
        )
    }
}

