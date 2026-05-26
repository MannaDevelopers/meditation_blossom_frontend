package app.mannadev.meditation.bible

import app.mannadev.meditation.data.bible.BibleDb
import app.mannadev.meditation.data.bible.BibleRepository
import app.mannadev.meditation.dto.SermonDto
import app.mannadev.meditation.model.BibleReferenceResolver
import app.mannadev.meditation.model.VerseParser
import org.junit.Assert.assertEquals
import org.junit.Test

class BibleReferenceResolverTest {

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
            books = mapOf("창세기" to 1, "신명기" to 5, "로마서" to 45, "요한복음" to 43, "요한1서" to 62),
            verses = mapOf(
                Triple(1, 22, 2) to "여호와께서 이르시되",
                Triple(5, 34, 4) to "이는 내가 아브라함과",
                Triple(45, 13, 11) to "또한 너희가",
                Triple(45, 13, 12) to "밤이 깊고",
                Triple(45, 13, 13) to "낮에와 같이",
                Triple(45, 13, 14) to "오직 주",
                Triple(43, 3, 16) to "하나님이 세상을",
                Triple(43, 3, 30) to "그는 흥하여야",
                Triple(62, 1, 1) to "태초부터 있는",
            ),
        )
        return BibleReferenceResolver(BibleRepository(db))
    }

    @Test fun `single range with prefix`() {
        val out = resolver().resolveContent("본문 : 로마서 13:11-14 기존본문무시")
        assertEquals(
            "본문 : 로마서 13:11-14 11 또한 너희가 12 밤이 깊고 13 낮에와 같이 14 오직 주",
            out,
        )
    }

    @Test fun `single verse drops number prefix`() {
        val out = resolver().resolveContent("본문 : 요한복음 3:16 옛 본문")
        assertEquals("본문 : 요한복음 3:16 하나님이 세상을", out)
    }

    @Test fun `multi range across books with book names`() {
        val out = resolver().resolveContent(
            "본문 : 창세기 22:2, 신명기 34:4, 요한복음 3:30 옛본문"
        )
        assertEquals(
            "본문 : 창세기 22:2, 신명기 34:4, 요한복음 3:30 2 여호와께서 이르시되 4 이는 내가 아브라함과 30 그는 흥하여야",
            out,
        )
    }

    @Test fun `no prefix is preserved as missing`() {
        val out = resolver().resolveContent("로마서 13:11-14 본문")
        assertEquals(
            "로마서 13:11-14 11 또한 너희가 12 밤이 깊고 13 낮에와 같이 14 오직 주",
            out,
        )
    }

    @Test fun `alias is resolved via repository`() {
        val out = resolver().resolveContent("본문 : 요한일서 1:1 옛본문")
        assertEquals("본문 : 요한일서 1:1 태초부터 있는", out)
    }

    @Test fun `roundtrip through VerseParser preserves structure`() {
        val input = "본문 : 로마서 13:11-14 old"
        val resolved = resolver().resolveContent(input)
        val dto = SermonDto(date = "2026-04-17", title = "t", content = resolved, dayOfWeek = "FRI")
        val sermon = VerseParser.verseDtoToVerse(dto)
        assertEquals("로마서 13:11-14", sermon.bookName)
        assertEquals(4, sermon.verses.size)
        assertEquals("11 또한 너희가", sermon.verses[0])
        assertEquals("14 오직 주", sermon.verses[3])
    }

    @Test fun `json single range with prefix uses DB not payload verses`() {
        val json = """[{"book":"로마서","chapter":13,"verse_start":11,"verse_end":14,"verses":[{"verse_number":11,"content":"IGNORED"}]}]"""
        val out = resolver().resolveBibleReferencesJson(json)
        assertEquals(
            "본문 : 로마서 13:11-14 11 또한 너희가 12 밤이 깊고 13 낮에와 같이 14 오직 주",
            out,
        )
    }

    @Test fun `json single verse drops number prefix`() {
        val json = """[{"book":"요한복음","chapter":3,"verse_start":16,"verse_end":16}]"""
        val out = resolver().resolveBibleReferencesJson(json)
        assertEquals("본문 : 요한복음 3:16 하나님이 세상을", out)
    }

    @Test fun `json multi range across books joins with comma`() {
        val json = """[
          {"book":"창세기","chapter":22,"verse_start":2,"verse_end":2},
          {"book":"신명기","chapter":34,"verse_start":4,"verse_end":4},
          {"book":"요한복음","chapter":3,"verse_start":30,"verse_end":30}
        ]"""
        val out = resolver().resolveBibleReferencesJson(json)
        assertEquals(
            "본문 : 창세기 22:2, 신명기 34:4, 요한복음 3:30 2 여호와께서 이르시되 4 이는 내가 아브라함과 30 그는 흥하여야",
            out,
        )
    }

    @Test fun `json alias is resolved via repository`() {
        val json = """[{"book":"요한일서","chapter":1,"verse_start":1,"verse_end":1}]"""
        val out = resolver().resolveBibleReferencesJson(json)
        assertEquals("본문 : 요한일서 1:1 태초부터 있는", out)
    }

    @Test(expected = Exception::class)
    fun `json empty array throws`() {
        resolver().resolveBibleReferencesJson("[]")
    }

    @Test(expected = Exception::class)
    fun `json malformed throws`() {
        resolver().resolveBibleReferencesJson("not-json")
    }
}
