package app.mannadev.meditation.model

import app.mannadev.meditation.data.bible.BibleDb
import app.mannadev.meditation.data.bible.BibleRepository
import app.mannadev.meditation.dto.SermonDto
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
        if (refs.isEmpty()) throw VerseParseException.NoBookNameException()

        val allRows = ArrayList<BibleDb.VerseRow>()
        val refStrings = refs.map { ref ->
            allRows.addAll(repo.getRange(ref.book, ref.chapter, ref.verse_start, ref.verse_end))
            val range = if (ref.verse_start == ref.verse_end) {
                "${ref.chapter}:${ref.verse_start}"
            } else {
                "${ref.chapter}:${ref.verse_start}-${ref.verse_end}"
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
        val verse_start: Int,
        val verse_end: Int,
    )

    companion object {
        internal val PART_REGEX = Regex(
            """^(?<book>[^\d\s]+(?:\s+[^\d\s]+)*)\s+(?<chapter>\d+):(?<start>\d+)(?:-(?<end>\d+))?$"""
        )
        private val json = Json { ignoreUnknownKeys = true }
    }
}
