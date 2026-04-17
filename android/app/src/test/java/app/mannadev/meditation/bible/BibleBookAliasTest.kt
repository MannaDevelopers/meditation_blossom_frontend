package app.mannadev.meditation.bible

import app.mannadev.meditation.data.bible.BibleBookAlias
import app.mannadev.meditation.data.bible.BookAliasNotFoundException
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class BibleBookAliasTest {

    @Test fun `tier1 exact map resolves known standard names`() {
        assertEquals("창세기", BibleBookAlias.resolve("창세기"))
        assertEquals("요한1서", BibleBookAlias.resolve("요한1서"))
        assertEquals("고린도전서", BibleBookAlias.resolve("고린도전서"))
    }

    @Test fun `tier1 exact map resolves common hangul number variants`() {
        assertEquals("요한1서", BibleBookAlias.resolve("요한일서"))
        assertEquals("요한2서", BibleBookAlias.resolve("요한이서"))
        assertEquals("요한3서", BibleBookAlias.resolve("요한삼서"))
    }

    @Test fun `tier1 exact map resolves compact variants`() {
        assertEquals("요한1서", BibleBookAlias.resolve("1요한"))
        assertEquals("요한1서", BibleBookAlias.resolve("요1"))
    }

    @Test fun `unknown input throws`() {
        assertThrows(BookAliasNotFoundException::class.java) {
            BibleBookAlias.resolve("이상한책명")
        }
    }
}
