package app.mannadev.meditation.data.bible

interface BibleDb {
    /** books.name → books.id 전체 매핑. Repository 초기화 시 1회 로드. */
    fun loadBookIdByName(): Map<String, Int>

    /** 단일 범위 조회. ORDER BY verse ASC. 빈 결과도 정상(상위에서 처리). */
    fun queryRange(bookId: Int, chapter: Int, startVerse: Int, endVerse: Int): List<VerseRow>

    data class VerseRow(val verse: Int, val text: String)
}
