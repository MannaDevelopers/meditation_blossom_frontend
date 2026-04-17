package app.mannadev.meditation.model

import app.mannadev.meditation.data.bible.BibleDb
import app.mannadev.meditation.data.bible.BibleRepository
import app.mannadev.meditation.dto.SermonDto
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class BibleReferenceResolver @Inject constructor(
    private val repo: BibleRepository,
) {
    /** DTO 생성 직후 호출되는 SSoT 중앙 변환. content만 DB 본문으로 교체. */
    fun resolveDto(dto: SermonDto): SermonDto = dto.copy(content = resolveContent(dto.content))

    /** FCM/Firestore content 문자열을 DB 본문으로 재구성한 문자열로 변환. */
    fun resolveContent(fcmContent: String): String {
        val match = VerseParser.BOOK_NAME_REGEX.find(fcmContent)
            ?: throw VerseParseException.NoPrefixException()
        val prefix = match.groups[1]?.value.orEmpty()       // "본문 : " 혹은 빈 문자열
        val reference = match.groups["bookName"]?.value?.trim()
            ?: throw VerseParseException.NoBookNameException()

        // 각 파트에는 반드시 책명이 있어야 한다(현 VerseParser와 동일 수준).
        val parts = reference.split(",").map { it.trim() }.filter { it.isNotEmpty() }
        val allRows = ArrayList<BibleDb.VerseRow>()
        for (part in parts) {
            val m = PART_REGEX.matchEntire(part)
                ?: throw VerseParseException.InvalidVerseFormatException()
            val bookName = m.groups["book"]!!.value.trim()
            val chapter = m.groups["chapter"]!!.value.toInt()
            val start = m.groups["start"]!!.value.toInt()
            val end = m.groups["end"]?.value?.toInt() ?: start
            allRows.addAll(repo.getRange(bookName, chapter, start, end))
        }

        val body = if (allRows.size == 1) {
            allRows[0].text
        } else {
            allRows.joinToString(" ") { "${it.verse} ${it.text}" }
        }
        return "${prefix}${reference} $body"
    }

    companion object {
        // 책명(필수) + 장:시작[-끝]. 책명은 공백을 포함한 비숫자 토큰 연속.
        internal val PART_REGEX = Regex(
            """^(?<book>[^\d\s]+(?:\s+[^\d\s]+)*)\s+(?<chapter>\d+):(?<start>\d+)(?:-(?<end>\d+))?$"""
        )
    }
}
