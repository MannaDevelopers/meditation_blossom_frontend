package app.mannadev.meditation.widget

import android.content.Context
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.GlanceTheme
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Column
import androidx.glance.layout.fillMaxSize
import androidx.glance.preview.ExperimentalGlancePreviewApi
import androidx.glance.preview.Preview
import androidx.glance.text.Text
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
        val verse = Verse.fromDto(verseDto)
        provideContent {
            VerseWidgetSmallContent(verse)
        }
    }
}

@Composable
fun VerseWidgetSmallContent(verse: Verse) {
    Column(
        modifier = GlanceModifier
            .fillMaxSize()
            .background(Color.Cyan),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(text = "Meditation Widget")
    }
}

@OptIn(ExperimentalGlancePreviewApi::class)
@Preview(widthDp = 200, heightDp = 150)
@Composable
fun VerseWidgetSmallPreview() {
    val verseDto = VerseDto(
        title = "2. 회심에 대하여(고백록)",
        content = "본문 : 로마서 13:11-14 11 또한 너희가 이 시기를 알거니와 자다가 깰 때가 벌써 되었으니 이는 이제 우리의 구원이 처음 믿을 때보다 가까웠음이라 12 밤이 깊고 낮이 가까웠으니 그러므로 우리가 어둠의 일을 벗고 빛의 갑옷을 입자 13 낮에와 같이 단정히 행하고 방탕하거나 술 취하지 말며 음란하거나 호색하지 말며 다투거나 시기하지 말고 14 오직 주 예수 그리스도로 옷 입고 정욕을 위하여 육신의 일을 도모하지 말라",
        date = "2025-05-25",
        dayOfWeek = "SUN"
    )
    val verse = Verse(
        bookName = "로마서 13:11-14",
        content = "11 또한 너희가 이 시기를 알거니와 자다가 깰 때가 벌써 되었으니 이는 이제 우리의 구원이 처음 믿을 때보다 가까웠음이라 12 밤이 깊고 낮이 가까웠으니 그러므로 우리가 어둠의 일을 벗고 빛의 갑옷을 입자 13 낮에와 같이 단정히 행하고 방탕하거나 술 취하지 말며 음란하거나 호색하지 말며 다투거나 시기하지 말고 14 오직 주 예수 그리스도로 옷 입고 정욕을 위하여 육신의 일을 도모하지 말라",
    )

    GlanceTheme {
        VerseWidgetSmallContent(verse)
    }
}
