package app.mannadev.meditation.model

import app.mannadev.meditation.dto.SermonDto
import com.google.common.annotations.VisibleForTesting

object VerseParser {

    private const val BOOK_NAME_REGEX_PATTERN =
        """(본문\s*[:：]?\s*)?(?<bookName>[^\d\s]+ ?\d+:\d+(?:-\d+)?(?:,\s*[^\d\s]+ ?\d+:\d+(?:-\d+)?)*)"""
    private val BOOK_NAME_REGEX = Regex(BOOK_NAME_REGEX_PATTERN)

    private val VERSE_RANGE_REGEX = Regex("""(\d+):(\d+)(?:-(\d+))?""") // Compile once

    private const val VERSE_SPLIT_REGEX_PATTERN = """\d+"""
    private val VERSE_SPLIT_REGEX = Regex(VERSE_SPLIT_REGEX_PATTERN)

    fun parse(dto: SermonDto): Sermon = verseDtoToVerse(dto)

    /**
     *  val verseDto = VerseDto(
     *    title = "2. 회심에 대하여(고백록)",
     *    content = "본문 : 로마서 13:11-14 11 또한 너희가 이 시기를 알거니와 자다가 깰 때가 벌써 되었으니 이는 이제 우리의 구원이 처음 믿을 때보다 가까웠음이라 12 밤이 깊고 낮이 가까웠으니 그러므로 우리가 어둠의 일을 벗고 빛의 갑옷을 입자 13 낮에와 같이 단정히 행하고 방탕하거나 술 취하지 말며 음란하거나 호색하지 말며 다투거나 시기하지 말고 14 오직 주 예수 그리스도로 옷 입고 정욕을 위하여 육신의 일을 도모하지 말라",
     *    date = "2025-05-25",
     *    dayOfWeek = "SUN"
     *  )
     *  val verse = Verse(
     *    contents = listOf(
     *      "11 또한 너희가 이 시기를 알거니와 자다가 깰 때가 벌써 되었으니 이는 이제 우리의 구원이 처음 믿을 때보다 가까웠음이라",
     *      "12 밤이 깊고 낮이 가까웠으니 그러므로 우리가 어둠의 일을 벗고 빛의 갑옷을 입자",
     *      "13 낮에와 같이 단정히 행하고 방탕하거나 술 취하지 말며 음란하거나 호색하지 말며 다투거나 시기하지 말고",
     *      "14 오직 주 예수 그리스도로 옷 입고 정욕을 위하여 육신의 일을 도모하지 말라"
     *    ),
     *    bookName = "로마서 13:11-14",
     *    title = "2. 회심에 대하여(고백록)"
     *  )
     */
    @VisibleForTesting
    fun verseDtoToVerse(dto: SermonDto): Sermon {
        // 1. 책 이름과 장:절을 추출
        val matchResult =
            BOOK_NAME_REGEX.find(dto.content) ?: throw VerseParseException.NoPrefixException()
        val bookName = matchResult.groups["bookName"]?.value?.trim()
            ?: throw VerseParseException.NoBookNameException()

        // 2. 본문 내용 추출
        val contentStartIndex = matchResult.range.last + 1
        val contentAfterBookName = dto.content.substring(contentStartIndex).trim()
        if (contentAfterBookName.isBlank()) throw VerseParseException.EmptyContentException()

        val verseNumbers = try {
            extractVerseNumbersFromReferenceString(bookName)
        } catch (e: Exception) {
            throw VerseParseException.InvalidVerseFormatException()
        }

        // 3. 구절 분리
        val verses = contentAfterBookName
            .split(VERSE_SPLIT_REGEX)
            .map { it.trim() }
            .filter { it.isNotBlank() }

        if (verseNumbers.size != verses.size) throw VerseParseException.InvalidVerseCountException(
            verseNumbers.size,
            verses.size
        )

        //구절이 하나만 있으면 앞에 번호 붙이지 않기.
        if (verses.size == 1) {
            return Sermon(
                verses = verses,
                bookName = bookName,
                title = dto.title
            )
        } else {
            val versesWithNumber =
                verses.mapIndexed { index, string -> "${verseNumbers[index]} $string" }
            return Sermon(
                verses = versesWithNumber,
                bookName = bookName,
                title = dto.title
            )
        }
    }

    @VisibleForTesting
    fun extractVerseNumbersFromReferenceString(bookName: String): List<String> {
        return bookName.split(",")
            .map { it.trim() }
            .mapNotNull { part ->
                val match = VERSE_RANGE_REGEX.find(part)
                if (match == null) return@mapNotNull null

                val start = match.groupValues[2].toInt()
                val end = match.groupValues[3].toIntOrNull() ?: start

                if (start == end) {
                    listOf(start.toString())
                } else {
                    (start..end).map { it.toString() }
                }
            }
            .flatten()
    }
}

