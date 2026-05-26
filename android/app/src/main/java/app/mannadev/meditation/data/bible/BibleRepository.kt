package app.mannadev.meditation.data.bible

import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class BibleRepository @Inject constructor(
    private val db: BibleDb,
) {
    @Volatile private var bookIdByName: Map<String, Int>? = null

    private fun bookIds(): Map<String, Int> {
        bookIdByName?.let { return it }
        return synchronized(this) {
            bookIdByName ?: db.loadBookIdByName().also { bookIdByName = it }
        }
    }

    /** alias 해석 → bookId 조회 → DB 범위 조회. 빈 결과는 [VerseRangeNotFoundException]. */
    fun getRange(bookName: String, chapter: Int, startVerse: Int, endVerse: Int): List<BibleDb.VerseRow> {
        val canonical = BibleBookAlias.resolve(bookName)
        val bookId = bookIds()[canonical]
            ?: throw BookAliasNotFoundException(bookName)
        val rows = db.queryRange(bookId, chapter, startVerse, endVerse)
        if (rows.isEmpty()) throw VerseRangeNotFoundException(canonical, chapter, startVerse, endVerse)
        return rows
    }
}
