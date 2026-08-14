package app.mannadev.meditation.ui.widget

import android.content.Context
import android.graphics.Bitmap
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.unit.dp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.ImageProvider
import androidx.glance.action.Action
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
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

class VerseWidgetLarge : GlanceAppWidget(
    errorUiLayout = R.layout.verse_widget_large_error,
) {
    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val sermonRepository = getWidgetDependencies(context).sermonRepository()
        val youtubeLinkEnabled = getWidgetDependencies(context).getWidgetPrefs().isEnabled()
        val widgetDesignRepository = getWidgetDependencies(context).widgetDesignRepository()
        val design = widgetDesignRepository.designState.value
        // produceState로 컴포저블 안에서 비동기 디코딩하면 Glance가 RemoteViews로 스냅샷을
        // 뜨는 시점과 경쟁해 이미지가 반영되지 않은 채로 위젯이 그려지는 경우가 있었다
        // (미리보기에만 배경이 보이고 실제 위젯엔 안 보이던 원인). sermonRepository와 동일하게
        // provideContent 밖, suspend 컨텍스트에서 먼저 디코딩을 끝내고 값으로 넘긴다.
        val galleryBitmap = if (design?.background?.type == "gallery") {
            withContext(Dispatchers.IO) {
                decodeGalleryBitmap(
                    design.background.value,
                    design.background.imageTransform,
                    BANNER_BITMAP_WIDTH,
                    BANNER_BITMAP_HEIGHT,
                )
            }
        } else {
            null
        }
        provideContent {
            val state by sermonRepository.sermonState.collectAsState()
            val sermon = state.toDisplaySermon(hasAppEverLaunched(context))
            val clickAction = widgetClickAction(sermon.videoUrl, Constants.DEEP_LINK_SUNDAY_SERMON)
            VerseWidgetLargeContent(sermon, clickAction, youtubeLinkEnabled, design, galleryBitmap)
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

// 갤러리 배경을 굽는 고정 해상도 — Glance가 실제 위젯 크기에 맞춰 늘려 채우므로(리사이즈돼도
// 동일 비트맵 재사용), gradientBackground.kt의 고정 200x200 그라데이션 비트맵과 같은 전략이다.
private const val BANNER_BITMAP_WIDTH = 800
private const val BANNER_BITMAP_HEIGHT = 400

/**
 * Composable function that defines the content of the large verse widget.
 * It displays the verse title, content (scrollable if it exceeds the available space), and book name.
 * The widget has a gradient background and is clickable to open the MainActivity.
 *
 * @param sermon The [Sermon] object containing the data to be displayed.
 * @param design 저장된 위젯 디자인(EditScreen에서 편집). null이면 편집 기능 도입 이전과 동일한
 *   하드코딩 스타일을 그대로 쓴다(=DEFAULT_WIDGET_DESIGN과 값이 같음).
 * @param galleryBitmap design.background.type이 "gallery"일 때 provideGlance에서 미리 디코딩해 둔
 *   비트맵. 컴포저블 안에서 비동기로 디코딩하면 Glance의 RemoteViews 스냅샷 시점과 경쟁해 반영되지
 *   않을 수 있어, 항상 완성된 값으로 전달받는다.
 */
@Composable
private fun VerseWidgetLargeContent(
    sermon: Sermon,
    clickAction: Action,
    youtubeLinkEnabled: Boolean,
    design: WidgetDesignDto?,
    galleryBitmap: Bitmap?,
) {
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
    val bookNameStyle = design?.text?.toBodyTextStyle() ?: Typography.labelMedium

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

