package app.mannadev.meditation.widget

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.ImageProvider
import androidx.glance.action.actionStartActivity
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.appWidgetBackground
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.lazy.LazyColumn
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxHeight
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.padding
import androidx.glance.layout.width
import androidx.glance.layout.wrapContentHeight
import androidx.glance.layout.wrapContentWidth
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextDefaults
import androidx.glance.unit.ColorProvider
import app.mannadev.meditation.MainActivity
import app.mannadev.meditation.data.Verse
import app.mannadev.meditation.dto.VerseDto

class VerseWidgetLarge : GlanceAppWidget() {
    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val verseDto = VerseDto(
            title = "2. 회심에 대하여(고백록)",
            content = "본문 : 로마서 13:11-14 11 또한 너희가 이 시기를 알거니와 자다가 깰 때가 벌써 되었으니 이는 이제 우리의 구원이 처음 믿을 때보다 가까웠음이라 12 밤이 깊고 낮이 가까웠으니 그러므로 우리가 어둠의 일을 벗고 빛의 갑옷을 입자 13 낮에와 같이 단정히 행하고 방탕하거나 술 취하지 말며 음란하거나 호색하지 말며 다투거나 시기하지 말고 14 오직 주 예수 그리스도로 옷 입고 정욕을 위하여 육신의 일을 도모하지 말라",
            date = "2025-05-25",
            dayOfWeek = "SUN"
        )
        val verse = Verse(
            contents = listOf(
                "11 또한 너희가 이 시기를 알거니와 자다가 깰 때가 벌써 되었으니 이는 이제 우리의 구원이 처음 믿을 때보다 가까웠음이라",
                "12 밤이 깊고 낮이 가까웠으니 그러므로 우리가 어둠의 일을 벗고 빛의 갑옷을 입자",
                "13 낮에와 같이 단정히 행하고 방탕하거나 술 취하지 말며 음란하거나 호색하지 말며 다투거나 시기하지 말고",
                "14 오직 주 예수 그리스도로 옷 입고 정욕을 위하여 육신의 일을 도모하지 말라"
            ),
            bookName = "로마서 13:11-14"
        )
        provideContent {
            VerseWidgetLargeContent(verse)
        }
    }
}


@Composable
private fun VerseWidgetLargeContent(verse: Verse) {
    val background = remember {
        createGradientBitmap(
            width = 200,
            height = 150,
            startColor = Color(0xFFFFE094).toArgb(),
            endColor = Color(0xFF99E6FF).toArgb()
        )
    }
    Row(
        modifier = GlanceModifier
            .fillMaxWidth()
            .wrapContentHeight()
            .clickable(actionStartActivity<MainActivity>())
            .appWidgetBackground()
            .cornerRadius(15.dp)
            .background(ImageProvider(background))
            .padding(top = 26.dp, bottom = 20.dp, start = 30.dp, end = 20.dp),
        horizontalAlignment = Alignment.Start,
        verticalAlignment = Alignment.Top
    ) {
        LazyColumn(
            GlanceModifier.fillMaxHeight().defaultWeight()
        ) {
            items(verse.contents.size) { index ->
                Text(
                    modifier = GlanceModifier.padding(horizontal = 19.dp),
                    text = verse.contents[index],
                    style = TextDefaults.defaultTextStyle
                        .copy(
                            fontWeight = FontWeight.Bold,
                            color = ColorProvider(Color.Black),
                            fontSize = 18.sp,
                        ),
                )
            }
        }

        Spacer(GlanceModifier.width(20.dp))
        Row(
            GlanceModifier.wrapContentWidth().fillMaxHeight(),
            horizontalAlignment = Alignment.End,
            verticalAlignment = Alignment.Bottom
        ) {
            Text(
                text = verse.bookName,
                style = TextDefaults.defaultTextStyle
                    .copy(
                        color = ColorProvider(Color.Black),
                        fontSize = 16.sp,
                    ),
            )
        }
    }
}

//@OptIn(ExperimentalGlancePreviewApi::class)
//@Preview(widthDp = 624, heightDp = 130)
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
//        VerseWidgetLargeContent(verse)
//    }
//}
