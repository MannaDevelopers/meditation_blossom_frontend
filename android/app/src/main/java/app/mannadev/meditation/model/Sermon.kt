package app.mannadev.meditation.model

import app.mannadev.meditation.analytics.CrashlyticsHelper
import app.mannadev.meditation.dto.SermonDto
import timber.log.Timber

data class Sermon(
    val verses: List<String>, // 말씀 내용 (예: "또 비유로 말씀하시되...")
    val bookName: String, // 성경 책 이름 (예: "마태복음")
    val title: String //설교 제목
) {
    companion object Companion {

        val errorSermon = Sermon(
            verses = listOf("내용을 불러올 수 없습니다."),
            title = "",
            bookName = ""
        )

        fun fromDto(dto: SermonDto): Sermon =
            try {
                VerseParser.parse(dto)
            } catch (e: Exception) {
                Timber.e(e, "Sermon.fromDto failed for dto: $dto")
                CrashlyticsHelper.recordException(e, "Sermon.fromDto parsing failed")
                errorSermon
            }
    }
}

