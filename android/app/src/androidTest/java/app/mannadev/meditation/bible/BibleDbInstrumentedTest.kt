package app.mannadev.meditation.bible

import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import app.mannadev.meditation.data.bible.BibleDbImpl
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class BibleDbInstrumentedTest {

    private val db = BibleDbImpl(ApplicationProvider.getApplicationContext())

    @Test fun loads_all_66_books() {
        val map = db.loadBookIdByName()
        assertEquals(66, map.size)
        assertTrue(map.containsKey("창세기"))
        assertTrue(map.containsKey("요한계시록"))
        assertTrue(map.containsKey("요한1서"))
    }

    @Test fun query_romans_13_11_to_14_returns_4_verses() {
        val books = db.loadBookIdByName()
        val rows = db.queryRange(bookId = books.getValue("로마서"), chapter = 13, startVerse = 11, endVerse = 14)
        assertEquals(4, rows.size)
        assertEquals(11, rows[0].verse)
        assertEquals(14, rows[3].verse)
        assertTrue(rows[0].text.isNotBlank())
    }
}
