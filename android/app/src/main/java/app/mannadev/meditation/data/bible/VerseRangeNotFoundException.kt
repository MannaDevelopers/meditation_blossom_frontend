package app.mannadev.meditation.data.bible

class VerseRangeNotFoundException(
    val book: String,
    val chapter: Int,
    val startVerse: Int,
    val endVerse: Int,
) : NoSuchElementException("No verses for $book $chapter:$startVerse-$endVerse")
