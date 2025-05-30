package app.mannadev.meditation.data

import app.mannadev.meditation.dto.VerseDto

class Verse(
    val contents: List<String>, // 말씀 내용 (예: "또 비유로 말씀하시되...")
    val bookName: String, // 성경 책 이름 (예: "마태복음")
) {
    companion object {
        fun fromDto(dto: VerseDto): Verse {
            //FIXME: dto의 content 를 파싱해서 적절한 형태로 변환하는 로직을 추가할 수 있습니다.
            return Verse(
                contents = listOf(dto.content),
                bookName = dto.title
            )
        }
    }
}