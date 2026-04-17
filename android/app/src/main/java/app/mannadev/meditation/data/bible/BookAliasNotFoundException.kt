package app.mannadev.meditation.data.bible

class BookAliasNotFoundException(val input: String)
    : IllegalArgumentException("Unknown bible book: '$input'")
