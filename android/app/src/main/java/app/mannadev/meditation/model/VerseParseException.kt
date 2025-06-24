package app.mannadev.meditation.model

sealed class VerseParseException(message: String) : Exception(message) {
    class NoPrefixException : VerseParseException("본문 : 접두사가 없습니다.")
    class NoBookNameException : VerseParseException("책 이름을 찾을 수 없습니다.")
    class EmptyContentException : VerseParseException("내용이 비어있습니다.")
    class NoVersesException : VerseParseException("구절이 없습니다.")
    class InvalidVerseFormatException : VerseParseException("구절이 숫자로 시작하지 않습니다.")
    class InvalidVerseCountException(expected: Int, actual: Int) :
        VerseParseException("구절 수가 맞지 않습니다. 예상: $expected, 실제: $actual")

    class InvalidVerseRangeException : VerseParseException("잘못된 구절 범위입니다.")
}