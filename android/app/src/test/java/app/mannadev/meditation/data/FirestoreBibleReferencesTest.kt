package app.mannadev.meditation.data

import app.mannadev.meditation.data.bible.BibleDb
import app.mannadev.meditation.data.bible.BibleRepository
import app.mannadev.meditation.model.BibleReferenceResolver
import org.junit.Assert.assertEquals
import org.junit.Test

class FirestoreBibleReferencesTest {

    private class FakeBibleDb(
        private val books: Map<String, Int>,
        private val verses: Map<Triple<Int, Int, Int>, String>,
    ) : BibleDb {
        override fun loadBookIdByName() = books
        override fun queryRange(bookId: Int, chapter: Int, startVerse: Int, endVerse: Int) =
            (startVerse..endVerse).mapNotNull { v ->
                verses[Triple(bookId, chapter, v)]?.let { BibleDb.VerseRow(v, it) }
            }
    }

    private fun resolver(): BibleReferenceResolver {
        val db = FakeBibleDb(
            books = mapOf("역대하" to 14),
            verses = mapOf(Triple(14, 33, 10) to "여호와께서 이르시되"),
        )
        return BibleReferenceResolver(BibleRepository(db))
    }

    // content 필드는 캐시성 편의 필드라 스키마에서 나중에 사라질 수 있으므로,
    // bible_references가 있으면 content가 있어도 항상 Bible DB에서 재구성한다.
    @Test fun `content가 있어도 bible_references가 있으면 항상 재구성`() {
        val data = mapOf(
            "content" to "이 값은 사용되면 안 됨",
            "bible_references" to listOf(
                mapOf("book" to "역대하", "chapter" to 33, "verse_start" to 10, "verse_end" to 10),
            ),
        )
        val out = resolveFirestoreContent(resolver(), data)
        assertEquals("본문 : 역대하 33:10 여호와께서 이르시되", out)
    }

    // qt 컬렉션 문서는 content 필드 자체가 없고 bible_references만 있다.
    @Test fun `content가 없으면 bible_references로부터 재구성`() {
        val data = mapOf(
            "bible_references" to listOf(
                mapOf("book" to "역대하", "chapter" to 33, "verse_start" to 10, "verse_end" to 10),
            ),
        )
        val out = resolveFirestoreContent(resolver(), data)
        assertEquals("본문 : 역대하 33:10 여호와께서 이르시되", out)
    }

    @Test fun `content도 bible_references도 없으면 빈 문자열`() {
        val out = resolveFirestoreContent(resolver(), emptyMap())
        assertEquals("", out)
    }

    @Test fun `bible_references 해석 실패 시 기존 content로 안전하게 대체`() {
        val data = mapOf(
            "content" to "본문 : 역대하 33:10-13 10 여호와께서 므낫세와 그의 백성에게...",
            "bible_references" to listOf(
                mapOf("book" to "존재하지않는책", "chapter" to 1, "verse_start" to 1, "verse_end" to 1),
            ),
        )
        val out = resolveFirestoreContent(resolver(), data)
        assertEquals("본문 : 역대하 33:10-13 10 여호와께서 므낫세와 그의 백성에게...", out)
    }

    @Test fun `bible_references 해석도 실패하고 content도 없으면 빈 문자열`() {
        val data = mapOf(
            "bible_references" to listOf(
                mapOf("book" to "존재하지않는책", "chapter" to 1, "verse_start" to 1, "verse_end" to 1),
            ),
        )
        val out = resolveFirestoreContent(resolver(), data)
        assertEquals("", out)
    }
}
