package app.mannadev.meditation.data

import app.mannadev.meditation.dto.VerseDto
import app.mannadev.meditation.model.Verse
import app.mannadev.meditation.model.VerseParseException
import app.mannadev.meditation.model.VerseParser
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Test

class VerseTest {

    @Test
    fun `fromDto standard input`() {
        // Test with a standard DTO input that matches the primary regex pattern.
        val verseDto = VerseDto(
            title = "2. 회심에 대하여(고백록)",
            content = "본문 : 로마서 13:11-14 11 또한 너희가 이 시기를 알거니와 자다가 깰 때가 벌써 되었으니 이는 이제 우리의 구원이 처음 믿을 때보다 가까웠음이라 12 밤이 깊고 낮이 가까웠으니 그러므로 우리가 어둠의 일을 벗고 빛의 갑옷을 입자 13 낮에와 같이 단정히 행하고 방탕하거나 술 취하지 말며 음란하거나 호색하지 말며 다투거나 시기하지 말고 14 오직 주 예수 그리스도로 옷 입고 정욕을 위하여 육신의 일을 도모하지 말라",
            date = "2025-05-25",
            dayOfWeek = "SUN"
        )

        val expectedVerse = Verse(
            verses = listOf(
                "11 또한 너희가 이 시기를 알거니와 자다가 깰 때가 벌써 되었으니 이는 이제 우리의 구원이 처음 믿을 때보다 가까웠음이라",
                "12 밤이 깊고 낮이 가까웠으니 그러므로 우리가 어둠의 일을 벗고 빛의 갑옷을 입자",
                "13 낮에와 같이 단정히 행하고 방탕하거나 술 취하지 말며 음란하거나 호색하지 말며 다투거나 시기하지 말고",
                "14 오직 주 예수 그리스도로 옷 입고 정욕을 위하여 육신의 일을 도모하지 말라"
            ),
            bookName = "로마서 13:11-14",
            title = "2. 회심에 대하여(고백록)"
        )

        val actualVerse = VerseParser.verseDtoToVerse(verseDto)

        assertEquals(expectedVerse.title, actualVerse.title)
        assertEquals(expectedVerse.bookName, actualVerse.bookName)
        assertArrayEquals(
            expectedVerse.verses.toTypedArray(),
            actualVerse.verses.toTypedArray()
        )
    }

    @Test
    fun `fromDto handles book name with space and number`() {
        val verseDto = VerseDto(
            title = "요한일서의 사랑",
            content = "본문 : 요한일서 4:7-8 7 사랑하는 자들아 우리가 서로 사랑하자 사랑은 하나님께 속한 것이니 사랑하는 자마다 하나님으로부터 나서 하나님을 알고 8 사랑하지 아니하는 자는 하나님을 알지 못하나니 이는 하나님은 사랑이심이라",
            date = "2025-05-26",
            dayOfWeek = "MON"
        )
        val expectedBookName = "요한일서 4:7-8"
        val expectedContents = listOf(
            "7 사랑하는 자들아 우리가 서로 사랑하자 사랑은 하나님께 속한 것이니 사랑하는 자마다 하나님으로부터 나서 하나님을 알고",
            "8 사랑하지 아니하는 자는 하나님을 알지 못하나니 이는 하나님은 사랑이심이라"
        )

        val actualVerse = VerseParser.verseDtoToVerse(verseDto)

        assertEquals(expectedBookName, actualVerse.bookName)
        assertArrayEquals(expectedContents.toTypedArray(), actualVerse.verses.toTypedArray())
        assertEquals(verseDto.title, actualVerse.title)
    }

    @Test
    fun `fromDto handles content without '본문 colon' prefix gracefully`() {
        val verseDto = VerseDto(
            title = "시편의 찬양",
            content = "시편 23:1-2 1 여호와는 나의 목자시니 내게 부족함이 없으리로다 2 그가 나를 푸른 풀밭에 누이시며 쉴 만한 물 가으로 인도하시는도다",
            date = "2025-05-27",
            dayOfWeek = "TUE"
        )
        val expectedVerse = Verse(
            verses = listOf(
                "1 여호와는 나의 목자시니 내게 부족함이 없으리로다",
                "2 그가 나를 푸른 풀밭에 누이시며 쉴 만한 물 가으로 인도하시는도다"
            ),
            bookName = "시편 23:1-2",
            title = verseDto.title
        )
        val actualVerse = VerseParser.verseDtoToVerse(verseDto)
        assertEquals(expectedVerse, actualVerse)
    }

    @Test
    fun `fromDto fallback parsing logic`() {
        val verseDto = VerseDto(
            title = "시편의 찬양",
            content = "시편 23:1-2 1 여호와는 나의 목자시니 내게 부족함이 없으리로다 2 그가 나를 푸른 풀밭에 누이시며 쉴 만한 물 가으로 인도하시는도다",
            date = "2025-05-27",
            dayOfWeek = "TUE"
        )

        val expectedVerse = Verse(
            verses = listOf(
                "1 여호와는 나의 목자시니 내게 부족함이 없으리로다",
                "2 그가 나를 푸른 풀밭에 누이시며 쉴 만한 물 가으로 인도하시는도다"
            ),
            bookName = "시편 23:1-2",
            title = verseDto.title
        )
        val actualVerse = VerseParser.verseDtoToVerse(verseDto)
        // No "본문 :" prefix, should return errorVerse
        assertEquals(expectedVerse, actualVerse)
    }

    @Test
    fun `fromDto no prefix`() {
        val verseDto = VerseDto(
            title = "잠언의 지혜",
            content = "잠언 3:5-6 5 너의 마음을 다하여 여호와를 의뢰하고 6 너의 모든 길에서 그를 인정하라",
            date = "2025-05-28",
            dayOfWeek = "WED"
        )
        val expectedVerse = Verse(
            verses = listOf(
                "5 너의 마음을 다하여 여호와를 의뢰하고",
                "6 너의 모든 길에서 그를 인정하라"
            ),
            bookName = "잠언 3:5-6",
            title = verseDto.title
        )
        val actualVerse = VerseParser.verseDtoToVerse(verseDto)
        assertEquals(expectedVerse, actualVerse)
    }

    @Test
    fun `fromDto book name with multiple spaces`() {
        val verseDto = VerseDto(
            title = "요한의 서신",
            content = "본문 : 요한일서 4:7-8 7 사랑하는 자들아 우리가 서로 사랑하자 8 사랑하지 아니하는 자는 하나님을 알지 못하나니",
            date = "2025-05-29",
            dayOfWeek = "THU"
        )

        val actualVerse = VerseParser.verseDtoToVerse(verseDto)

        assertEquals("요한일서 4:7-8", actualVerse.bookName)
        assertEquals(2, actualVerse.verses.size)
        assertEquals("7 사랑하는 자들아 우리가 서로 사랑하자", actualVerse.verses[0])
        assertEquals("8 사랑하지 아니하는 자는 하나님을 알지 못하나니", actualVerse.verses[1])
        assertEquals(verseDto.title, actualVerse.title)
    }

    @Test
    fun `fromDto book name with leading trailing spaces`() {
        val verseDto = VerseDto(
            title = "로마서의 가르침",
            content = "본문 :   로마서   13:11-14   11 또한 너희가 이 시기를 알거니와",
            date = "2025-05-30",
            dayOfWeek = "FRI"
        )

        val exception = runCatching { VerseParser.verseDtoToVerse(verseDto) }.exceptionOrNull()
        assert(exception is VerseParseException)
    }

    @Test
    fun `fromDto chapter verse range`() {
        val verseDto = VerseDto(
            title = "시편의 찬양",
            content = "본문 : 시편 23:1-6 1 여호와는 나의 목자시니 2 그가 나를 푸른 풀밭에 누이시며 3 내 영혼을 소생시키시는도다",
            date = "2025-05-31",
            dayOfWeek = "SAT"
        )
        val exception = runCatching { VerseParser.verseDtoToVerse(verseDto) }.exceptionOrNull()
        assert(exception is VerseParseException)
    }

    @Test
    fun `fromDto single chapter verse`() {
        val verseDto = VerseDto(
            title = "요한복음의 말씀",
            content = "본문 : 요한복음 3:16 16 하나님이 세상을 이처럼 사랑하사 독생자를 주셨으니",
            date = "2025-06-01",
            dayOfWeek = "SUN"
        )

        val actualVerse = VerseParser.verseDtoToVerse(verseDto)

        assertEquals("요한복음 3:16", actualVerse.bookName)
        assertEquals(1, actualVerse.verses.size)
        assertEquals("16 하나님이 세상을 이처럼 사랑하사 독생자를 주셨으니", actualVerse.verses[0])
        assertEquals(verseDto.title, actualVerse.title)
    }

    @Test
    fun `fromDto mainContent empty after parsing`() {
        val verseDto = VerseDto(
            title = "빈 내용",
            content = "본문 : 로마서 13:11-14",
            date = "2025-06-02",
            dayOfWeek = "MON"
        )
        val exception = runCatching { VerseParser.verseDtoToVerse(verseDto) }.exceptionOrNull()
        assert(exception is VerseParseException)
    }

    @Test
    fun `fromDto mainContent with no verse numbers`() {
        val verseDto = VerseDto(
            title = "시편의 찬양",
            content = "본문 : 시편 23:1-6 여호와는 나의 목자시니 내게 부족함이 없으리로다",
            date = "2025-06-03",
            dayOfWeek = "TUE"
        )
        val exception = runCatching { VerseParser.verseDtoToVerse(verseDto) }.exceptionOrNull()
        assert(exception is VerseParseException)
    }

    @Test
    fun `fromDto mainContent with multiple verse lines`() {
        val verseDto = VerseDto(
            title = "잠언의 지혜",
            content = "본문 : 잠언 3:5-6 5 너의 마음을 다하여 여호와를 의뢰하고 6 너의 모든 길에서 그를 인정하라",
            date = "2025-06-04",
            dayOfWeek = "WED"
        )

        val actualVerse = VerseParser.verseDtoToVerse(verseDto)

        assertEquals("잠언 3:5-6", actualVerse.bookName)
        assertEquals(2, actualVerse.verses.size)
        assertEquals("5 너의 마음을 다하여 여호와를 의뢰하고", actualVerse.verses[0])
        assertEquals("6 너의 모든 길에서 그를 인정하라", actualVerse.verses[1])
        assertEquals(verseDto.title, actualVerse.title)
    }

    @Test
    fun `fromDto mainContent with leading trailing spaces around verse numbers`() {
        val verseDto = VerseDto(
            title = "시편의 찬양",
            content = "본문 : 시편 23:1-2 1  여호와는 나의 목자시니  2  그가 나를 푸른 풀밭에 누이시며",
            date = "2025-06-05",
            dayOfWeek = "THU"
        )

        val actualVerse = VerseParser.verseDtoToVerse(verseDto)

        assertEquals("시편 23:1-2", actualVerse.bookName)
        assertEquals(2, actualVerse.verses.size)
        assertEquals("1 여호와는 나의 목자시니", actualVerse.verses[0].trim())
        assertEquals("2 그가 나를 푸른 풀밭에 누이시며", actualVerse.verses[1].trim())
        assertEquals(verseDto.title, actualVerse.title)
    }

    @Test
    fun `fromDto mainContent starting without a verse number`() {
        val verseDto = VerseDto(
            title = "시편의 찬양",
            content = "본문 : 시편 23:1-2 이 시는 다윗의 시라 1 여호와는 나의 목자시니",
            date = "2025-06-06",
            dayOfWeek = "FRI"
        )
        val actualVerse = VerseParser.verseDtoToVerse(verseDto)
        assertEquals("시편 23:1-2", actualVerse.bookName)
        assertEquals(2, actualVerse.verses.size)
        assertEquals("1 이 시는 다윗의 시라", actualVerse.verses[0].trim())
        assertEquals("2 여호와는 나의 목자시니", actualVerse.verses[1].trim())
        assertEquals(verseDto.title, actualVerse.title)
    }

    @Test
    fun `fromDto DTO content completely empty`() {
        val verseDto = VerseDto(
            title = "빈 내용",
            content = "",
            date = "2025-06-07",
            dayOfWeek = "SAT"
        )

        val exception = runCatching { VerseParser.verseDtoToVerse(verseDto) }.exceptionOrNull()
        assert(exception is VerseParseException)
    }

    @Test
    fun `fromDto DTO content only`() {
        val verseDto = VerseDto(
            title = "빈 내용",
            content = "본문 : ",
            date = "2025-06-08",
            dayOfWeek = "SUN"
        )

        val exception = runCatching { VerseParser.verseDtoToVerse(verseDto) }.exceptionOrNull()
        assert(exception is VerseParseException)
    }

    @Test
    fun `fromDto DTO content with unusual spacing`() {
        val verseDto = VerseDto(
            title = "시편의 찬양",
            content = "본문    :    시편    23:1-2    1    여호와는 나의 목자시니",
            date = "2025-06-09",
            dayOfWeek = "MON"
        )

        val exception = runCatching { VerseParser.verseDtoToVerse(verseDto) }.exceptionOrNull()
        assert(exception is VerseParseException)
    }

    @Test
    fun `fromDto DTO content with only book name and chapter verse no verse text`() {
        val verseDto = VerseDto(
            title = "빈 내용",
            content = "본문 : 로마서 13:11-14",
            date = "2025-06-11",
            dayOfWeek = "WED"
        )
        val exception = runCatching { VerseParser.verseDtoToVerse(verseDto) }.exceptionOrNull()
        assert(exception is VerseParseException)
    }

    @Test
    fun `fromDto primary regex failure fallback also fails to parse book name`() {
        val verseDto = VerseDto(
            title = "잘못된 형식",
            content = "잘못된 형식의 내용입니다",
            date = "2025-06-12",
            dayOfWeek = "THU"
        )
        val exception = runCatching { VerseParser.verseDtoToVerse(verseDto) }.exceptionOrNull()
        assert(exception is VerseParseException)
    }

    @Test
    fun `fromDto empty verseLines list`() {
        val verseDto = VerseDto(
            title = "빈 구절",
            content = "본문 : 로마서 13:11-14 ",
            date = "2025-06-13",
            dayOfWeek = "FRI"
        )
        val exception = runCatching { VerseParser.verseDtoToVerse(verseDto) }.exceptionOrNull()
        assert(exception is VerseParseException)
    }

    @Test
    fun `fromDto mainContent with only numbers and spaces`() {
        val verseDto = VerseDto(
            title = "숫자만 있는 내용",
            content = "본문 : 로마서 13:11-14 11 12 13 14",
            date = "2025-06-17",
            dayOfWeek = "TUE"
        )
        val exception = runCatching { VerseParser.verseDtoToVerse(verseDto) }.exceptionOrNull()
        assert(exception is VerseParseException)
    }

    @Test
    fun `fromDto book name with numbers at the end like 1`() {
        val verseDto = VerseDto(
            title = "역대하의 말씀",
            content = "본문 : 역대하 1:1 1 솔로몬이 여호와를 의지하고",
            date = "2025-06-18",
            dayOfWeek = "WED"
        )

        val actualVerse = VerseParser.verseDtoToVerse(verseDto)

        assertEquals("역대하 1:1", actualVerse.bookName)
        assertEquals(1, actualVerse.verses.size)
        assertEquals("1 솔로몬이 여호와를 의지하고", actualVerse.verses[0])
        assertEquals(verseDto.title, actualVerse.title)
    }

    @Test
    fun `fromDto verse lines not starting with number`() {
        val verseDto = VerseDto(
            title = "시편의 찬양",
            content = "본문 : 시편 23:1-2 이 시는 다윗의 시라 여호와는 나의 목자시니",
            date = "2025-06-19",
            dayOfWeek = "THU"
        )
        val exception = runCatching { VerseParser.verseDtoToVerse(verseDto) }.exceptionOrNull()
        assert(exception is VerseParseException)
    }

    @Test
    fun `fromDto has multi verse`() {
        val verseDto = VerseDto(
            title = "시편의 찬양",
            content = "본문 : 창세기 22:2, 신명기 34:4, 요한복음 3:30 2 여호와께서 이르시되 네 아들 네 사랑하는 독자 이삭을 데리고 모리아 땅으로 가서 내가 네게 일러 준 한 산 거기서 그를 번제로 드리라 4 여호와께서 그에게 이르시되 이는 내가 아브라함과 이삭과 야곱에게 맹세하여 그의 후손에게 주리라 한 땅이라 내가 네 눈으로 보게 하였거니와 너는 그리로 건너가지 못하리라 하시매 30 그는 흥하여야 하겠고 나는 쇠하여야 하리라 하니라",
            date = "2025-06-19",
            dayOfWeek = "THU"
        )

        val actualVerse = VerseParser.verseDtoToVerse(verseDto)

        assertEquals("창세기 22:2, 신명기 34:4, 요한복음 3:30", actualVerse.bookName)
        assertEquals(3, actualVerse.verses.size)
        assertEquals(
            "2 여호와께서 이르시되 네 아들 네 사랑하는 독자 이삭을 데리고 모리아 땅으로 가서 내가 네게 일러 준 한 산 거기서 그를 번제로 드리라",
            actualVerse.verses[0]
        )
        assertEquals(verseDto.title, actualVerse.title)
    }


}

class BookNameToVerseRangesTest {

    @Test
    fun `bookNameToVerseRanges with standard input`() {
        val bookName = "로마서 13:11-14"
        val expectedRanges = arrayOf("11", "12", "13", "14")
        assertArrayEquals(
            expectedRanges,
            VerseParser.extractVerseNumbersFromReferenceString(bookName).toTypedArray()
        )
    }


    @Test
    fun `bookNameToVerseRanges with single verse`() {
        val bookName = "역대하 1:1"
        val expectedRanges = arrayOf("1")
        assertArrayEquals(
            expectedRanges,
            VerseParser.extractVerseNumbersFromReferenceString(bookName).toTypedArray()
        )
    }

    @Test
    fun `bookNameToVerseRanges with multi books`() {
        val bookName = "창세기 22:2, 신명기 34:4, 요한복음 3:30"
        val expectedRanges = arrayOf("2", "4", "30")
        assertArrayEquals(
            expectedRanges,
            VerseParser.extractVerseNumbersFromReferenceString(bookName).toTypedArray()
        )
    }
}