package app.mannadev.meditation.ui.widget

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.action.actionStartActivity
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.appWidgetBackground
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.lazy.LazyColumn
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextDefaults
import app.mannadev.meditation.MainActivity
import app.mannadev.meditation.data.Verse
import app.mannadev.meditation.dto.VerseDto

class VerseWidgetSmall : GlanceAppWidget() {
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
            bookName = "로마서 13:11-14",
            title = "2. 회심에 대하여(고백록)"
        )
        provideContent {
            VerseWidgetSmallContent(verse)
        }
    }
}

@Composable
private fun VerseWidgetSmallContent(verse: Verse) {
    Column(
        modifier = GlanceModifier
            .fillMaxSize()
            .clickable(actionStartActivity<MainActivity>())
            .appWidgetBackground()
            .background(Color.White)
            .padding(vertical = 17.dp, horizontal = 18.dp),
        horizontalAlignment = Alignment.Start,
        verticalAlignment = Alignment.Top
    ) {
        Row(
            GlanceModifier.padding(start = 6.dp)
        ) {
            Text(
                "묵상",
                style = TextDefaults.defaultTextStyle
                    .copy(
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp
                    ),
            )
        }
        Spacer(GlanceModifier.height(17.dp))
        Column(
            GlanceModifier
                .cornerRadius(15.dp)
                .xmlGradientBackground()
                .padding(vertical = 34.dp)
        ) {
            LazyColumn(
                GlanceModifier.height(120.dp)
            ) {
                items(verse.contents.size) { index ->
                    Text(
                        modifier = GlanceModifier.padding(horizontal = 19.dp),
                        text = verse.contents[index],
                        style = TextDefaults.defaultTextStyle
                            .copy(
                                fontWeight = FontWeight.Bold,
                                fontSize = 18.sp,
                            ),
                    )
                }
            }

            Spacer(GlanceModifier.height(20.dp))
            Text(
                modifier = GlanceModifier.padding(horizontal = 19.dp),
                text = verse.bookName,
                style = TextDefaults.defaultTextStyle
                    .copy(
                        fontSize = 16.sp,
                    ),
            )
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
