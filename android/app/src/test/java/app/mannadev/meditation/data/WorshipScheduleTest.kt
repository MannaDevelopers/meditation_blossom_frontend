package app.mannadev.meditation.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.ZoneId
import java.time.ZonedDateTime

class WorshipScheduleTest {

    // 테스트가 실행 위치의 로컬 타임존에 영향받지 않도록 고정한다(JS 테스트와 달리 Kotlin
    // 유닛 테스트는 여러 시스템에서 실행될 수 있음).
    private val zone: ZoneId = ZoneId.of("Asia/Seoul")

    @Test
    fun `resolveWorshipDateTime resolves the well-known ISO week epoch anchor`() {
        // 1970-W01 Monday = 1969-12-29 -> Sat(1970-01-03) 17:00, Sun(1970-01-04) 09:50
        val sat = WorshipSchedule.resolveWorshipDateTime("1970-W01", "SAT_1700", zone)!!
        val sun = WorshipSchedule.resolveWorshipDateTime("1970-W01", "SUN_0950", zone)!!

        assertEquals(
            ZonedDateTime.of(1970, 1, 3, 17, 0, 0, 0, zone).toInstant(),
            sat,
        )
        assertEquals(
            ZonedDateTime.of(1970, 1, 4, 9, 50, 0, 0, zone).toInstant(),
            sun,
        )
    }

    @Test
    fun `resolveWorshipDateTime orders the 4 worship times within the same week correctly`() {
        val week = "2026-W37"
        val times = listOf("SAT_1700", "SUN_0950", "SUN_1150", "SUN_1430")
            .map { WorshipSchedule.resolveWorshipDateTime(week, it, zone)!! }

        for (i in 1 until times.size) {
            assertTrue("${times[i - 1]} should be before ${times[i]}", times[i - 1].isBefore(times[i]))
        }
    }

    @Test
    fun `resolveWorshipDateTime returns null for malformed input`() {
        assertNull(WorshipSchedule.resolveWorshipDateTime("", "SUN_0950", zone))
        assertNull(WorshipSchedule.resolveWorshipDateTime("2026-37", "SUN_0950", zone))
        assertNull(WorshipSchedule.resolveWorshipDateTime("not-a-week", "SUN_0950", zone))
        assertNull(WorshipSchedule.resolveWorshipDateTime("2026-W00", "SUN_0950", zone))
        assertNull(WorshipSchedule.resolveWorshipDateTime("2026-W54", "SUN_0950", zone))
        assertNull(WorshipSchedule.resolveWorshipDateTime("2026-W37", "UNKNOWN", zone))
    }

    @Test
    fun `hasWorshipTimeArrived is false just before, true at and after the scheduled time`() {
        val week = "2026-W37"
        val worshipType = "SUN_1150"
        val scheduled = WorshipSchedule.resolveWorshipDateTime(week, worshipType, zone)!!

        assertFalse(WorshipSchedule.hasWorshipTimeArrived(week, worshipType, scheduled.minusMillis(1), zone))
        assertTrue(WorshipSchedule.hasWorshipTimeArrived(week, worshipType, scheduled, zone))
        assertTrue(WorshipSchedule.hasWorshipTimeArrived(week, worshipType, scheduled.plusMillis(1), zone))
    }

    @Test
    fun `hasWorshipTimeArrived fails open when week or worshipType is missing or unparseable`() {
        assertTrue(WorshipSchedule.hasWorshipTimeArrived(null, "SUN_0950"))
        assertTrue(WorshipSchedule.hasWorshipTimeArrived("2026-W37", null))
        assertTrue(WorshipSchedule.hasWorshipTimeArrived("", "SUN_0950"))
        assertTrue(WorshipSchedule.hasWorshipTimeArrived("not-a-week", "SUN_0950"))
    }
}
