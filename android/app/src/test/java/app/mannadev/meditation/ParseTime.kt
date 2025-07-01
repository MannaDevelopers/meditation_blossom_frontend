package app.mannadev.meditation

import org.junit.Test
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter


class ParseTime {

    @Test
    fun parseDateTime() {
        val time = "2025년 5월 13일 오후 5시 18분 44초 UTC+9"

        val localDateTime = time.removeSuffix(" UTC+9")
        val formatter1 = DateTimeFormatter
//            .ofLocalizedDateTime(FormatStyle.FULL)
//            .withLocale(Locale.KOREAN)
            .ofPattern("yyyy년 M월 d일 a h시 m분 s초")

        println(LocalDateTime.parse(localDateTime, formatter1).atZone(ZoneId.of("Asia/Seoul")))
    }

    @Test
    fun parseDateTime2() {
        val time = "2025-05-13T17:18:44+09:00"

        val formatter1 = DateTimeFormatter
            .ISO_OFFSET_DATE_TIME

        println(ZonedDateTime.parse(time, formatter1))
        println(LocalDateTime.parse(time, formatter1))
    }
}