package app.mannadev.meditation.data

import app.mannadev.meditation.dto.VerseDto

data class Verse(
    val verses: List<String>, // 말씀 내용 (예: "또 비유로 말씀하시되...")
    val bookName: String, // 성경 책 이름 (예: "마태복음")
    val title: String //설교 제목
) {
    companion object {

        val errorVerse = Verse(
            verses = listOf("내용을 불러올 수 없습니다."),
            title = "",
            bookName = ""
        )

        fun fromDto(dto: VerseDto): Verse =
            try {
                VerseParser.parse(dto)
            } catch (_: Exception) {
                errorVerse
            }
    }
}

