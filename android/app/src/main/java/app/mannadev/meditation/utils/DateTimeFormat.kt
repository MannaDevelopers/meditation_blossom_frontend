package app.mannadev.meditation.utils

import java.time.LocalDateTime
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter

object DateTimeFormat {

    fun parseDateTime(time: String): ZonedDateTime {
        return runCatching {
            ZonedDateTime.parse(time, DateTimeFormatter.ISO_OFFSET_DATE_TIME)
        }.recover {
            val localDateTime = time.removeSuffix(" UTC+9")
            val formatter = DateTimeFormatter
                .ofPattern("yyyy년 M월 d일 a h시 m분 s초")
            LocalDateTime.parse(localDateTime, formatter).atZone(ZoneId.of("Asia/Seoul"))
        }.getOrThrow()
    }
}