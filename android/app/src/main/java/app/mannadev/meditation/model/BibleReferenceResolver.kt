package app.mannadev.meditation.model

import app.mannadev.meditation.data.bible.BibleDb
import app.mannadev.meditation.data.bible.BibleRepository
import app.mannadev.meditation.dto.SermonDto
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class BibleReferenceResolver @Inject constructor(
    private val repo: BibleRepository,
) {
    fun resolveDto(dto: SermonDto): SermonDto = dto.copy(content = resolveContent(dto.content))

    fun resolveContent(fcmContent: String): String {
        val match = VerseParser.BOOK_NAME_REGEX.find(fcmContent)
            ?: throw VerseParseException.NoPrefixException()
        val prefix = match.groups[1]?.value.orEmpty()
        val reference = match.groups["bookName"]?.value?.trim()
            ?: throw VerseParseException.NoBookNameException()

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

    /** v2 `bible_references` JSON 배열 문자열을 받아 "본문 : {refs} {body}" 형식으로 반환. */
    fun resolveBibleReferencesJson(jsonStr: String): String {
        val refs = json.decodeFromString<List<BibleReferenceJson>>(jsonStr)
        if (refs.isEmpty()) throw VerseParseException.EmptyReferencesException()

        val allRows = ArrayList<BibleDb.VerseRow>()
        val refStrings = refs.map { ref ->
            allRows.addAll(repo.getRange(ref.book, ref.chapter, ref.verseStart, ref.verseEnd))
            val range = if (ref.verseStart == ref.verseEnd) {
                "${ref.chapter}:${ref.verseStart}"
            } else {
                "${ref.chapter}:${ref.verseStart}-${ref.verseEnd}"
            }
            "${ref.book} $range"
        }
        val reference = refStrings.joinToString(", ")
        val body = if (allRows.size == 1) {
            allRows[0].text
        } else {
            allRows.joinToString(" ") { "${it.verse} ${it.text}" }
        }
        return "본문 : $reference $body"
    }

    @Serializable
    private data class BibleReferenceJson(
        val book: String,
        val chapter: Int,
        @SerialName("verse_start") val verseStart: Int,
        @SerialName("verse_end") val verseEnd: Int,
    )

    companion object {
        // 책 이름 토큰은 \S+로 매칭 — "요한1서"처럼 이름에 숫자가 포함된 경우
        // [^\d\s]+(숫자 제외)로는 매칭 실패하는 문제가 있어 수정함
        internal val PART_REGEX = Regex(
            """^(?<book>\S+(?:\s+\S+)*)\s+(?<chapter>\d+):(?<start>\d+)(?:-(?<end>\d+))?$"""
        )
        private val json = Json { ignoreUnknownKeys = true }
    }
}
