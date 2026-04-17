package app.mannadev.meditation.bible

import app.mannadev.meditation.data.bible.BibleDb
import app.mannadev.meditation.data.bible.BibleRepository
import app.mannadev.meditation.data.bible.BookAliasNotFoundException
import app.mannadev.meditation.data.bible.VerseRangeNotFoundException
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class BibleRepositoryTest {

    private class FakeBibleDb(
        private val books: Map<String, Int>,
        private val verses: Map<Triple<Int, Int, Int>, String>,
    ) : BibleDb {
        override fun loadBookIdByName(): Map<String, Int> = books
        override fun queryRange(
            bookId: Int, chapter: Int, startVerse: Int, endVerse: Int,
        ): List<BibleDb.VerseRow> =
            (startVerse..endVerse).mapNotNull { v ->
                verses[Triple(bookId, chapter, v)]?.let { BibleDb.VerseRow(v, it) }
            }
    }

    private fun repo(): BibleRepository {
        val db = FakeBibleDb(
            books = mapOf("로마서" to 45, "요한1서" to 62),
            verses = mapOf(
                Triple(45, 13, 11) to "또한 너희가",
                Triple(45, 13, 12) to "밤이 깊고",
                Triple(45, 13, 13) to "낮에와 같이",
                Triple(45, 13, 14) to "오직 주",
                Triple(62, 1, 1) to "태초부터 있는",
            ),
        )
        return BibleRepository(db)
    }

    @Test fun `returns verses in order for standard name`() {
        val rows = repo().getRange("로마서", 13, 11, 14)
        assertEquals(4, rows.size)
        assertEquals(11, rows[0].verse)
        assertEquals("또한 너희가", rows[0].text)
        assertEquals(14, rows[3].verse)
    }

    @Test fun `resolves alias before query`() {
        val rows = repo().getRange("요한일서", 1, 1, 1)
        assertEquals(1, rows.size)
        assertEquals("태초부터 있는", rows[0].text)
    }

    @Test fun `empty result throws VerseRangeNotFoundException`() {
        assertThrows(VerseRangeNotFoundException::class.java) {
            repo().getRange("로마서", 99, 1, 3)
        }
    }

    @Test fun `unknown book throws BookAliasNotFoundException`() {
        assertThrows(BookAliasNotFoundException::class.java) {
            repo().getRange("전혀모르는책", 1, 1, 1)
        }
    }
}
