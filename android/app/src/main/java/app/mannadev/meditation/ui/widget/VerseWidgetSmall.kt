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
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.text.Text
import app.mannadev.meditation.MainActivity
import app.mannadev.meditation.data.Verse
import app.mannadev.meditation.dto.VerseDto
import app.mannadev.meditation.ui.widget.theme.Typography

class VerseWidgetSmall : GlanceAppWidget() {
    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val verseDto = VerseDto(
            title = "2. 회심에 대하여(고백록)",
            content = "본문 : 로마서 13:11-14 11 또한 너희가 이 시기를 알거니와 자다가 깰 때가 벌써 되었으니 이는 이제 우리의 구원이 처음 믿을 때보다 가까웠음이라 12 밤이 깊고 낮이 가까웠으니 그러므로 우리가 어둠의 일을 벗고 빛의 갑옷을 입자 13 낮에와 같이 단정히 행하고 방탕하거나 술 취하지 말며 음란하거나 호색하지 말며 다투거나 시기하지 말고 14 오직 주 예수 그리스도로 옷 입고 정욕을 위하여 육신의 일을 도모하지 말라",
            date = "2025-05-25",
            dayOfWeek = "SUN"
        )
        provideContent {
            VerseWidgetSmallContent(Verse.fromDto(verseDto))
        }
    }
}


private object VerseSmallWidgetDimens {
    val appBarHeight = 56.dp
    val horizontalPadding = 24.dp
    val bookNameTopSpacer = 8.dp
    val contentBackgroundRadius = 16.dp
    val contentPadding = 12.dp
    val widgetPadding = 12.dp
}

@Composable
private fun VerseWidgetSmallContent(verse: Verse) {
    Column(
        modifier = GlanceModifier
            .fillMaxSize()
            .clickable(actionStartActivity<MainActivity>())
            .appWidgetBackground()
            .background(Color.White),
        horizontalAlignment = Alignment.Start,
        verticalAlignment = Alignment.Top
    ) {
        Row(
            GlanceModifier.height(VerseSmallWidgetDimens.appBarHeight)
                .padding(start = VerseSmallWidgetDimens.horizontalPadding),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                verse.title,
                style = Typography.titleMedium,
                maxLines = 1
            )
        }
        Box(
            GlanceModifier
                .padding(horizontal = VerseSmallWidgetDimens.widgetPadding)
                .padding(bottom = VerseSmallWidgetDimens.widgetPadding)
        ) {
            Column(
                GlanceModifier
                    .cornerRadius(VerseSmallWidgetDimens.contentBackgroundRadius)
                    .xmlGradientBackground()
                    .fillMaxSize()
            ) {
                LazyColumn(
                    GlanceModifier.defaultWeight().fillMaxWidth()
                ) {
                    item {
                        Spacer(GlanceModifier.height(VerseSmallWidgetDimens.contentPadding))
                    }
                    items(verse.verses) { verse ->
                        Text(
                            modifier = GlanceModifier
                                .fillMaxWidth()
                                .padding(horizontal = VerseSmallWidgetDimens.contentPadding)
                                .clickable(actionStartActivity<MainActivity>()),
                            text = verse,
                            style = Typography.bodyMedium,
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
                    text = verse.bookName,
                    style = Typography.labelSmall,
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
