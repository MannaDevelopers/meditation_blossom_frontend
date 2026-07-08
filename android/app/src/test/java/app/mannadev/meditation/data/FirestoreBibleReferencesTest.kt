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

    // 실제 sermons 컬렉션 문서(REST API로 확인)는 content가 이미 완전히 해석된
    // "본문 : ..." 문자열이고 bible_references도 함께 존재한다. bible_references를
    // 우선시하면 불필요한 재해석 실패 위험이 생기므로 기존 content를 그대로 써야 한다.
    @Test fun `기존 content가 있으면 bible_references를 무시하고 그대로 사용`() {
        val data = mapOf(
            "content" to "본문 : 역대하 33:10-13 10 여호와께서 므낫세와 그의 백성에게...",
            "bible_references" to listOf(
                mapOf("book" to "존재하지않는책", "chapter" to 1, "verse_start" to 1, "verse_end" to 1),
            ),
        )
        val out = resolveFirestoreContent(resolver(), data)
        assertEquals("본문 : 역대하 33:10-13 10 여호와께서 므낫세와 그의 백성에게...", out)
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

    @Test fun `bible_references 해석 실패 시 빈 문자열로 안전하게 대체`() {
        val data = mapOf(
            "bible_references" to listOf(
                mapOf("book" to "존재하지않는책", "chapter" to 1, "verse_start" to 1, "verse_end" to 1),
            ),
        )
        val out = resolveFirestoreContent(resolver(), data)
        assertEquals("", out)
    }
}
