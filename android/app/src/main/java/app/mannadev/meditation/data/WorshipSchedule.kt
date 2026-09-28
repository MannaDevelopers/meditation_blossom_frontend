package app.mannadev.meditation.data

import java.time.DateTimeException
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.temporal.ChronoField
import java.time.temporal.IsoFields

/**
 * 예배시간(WorshipType)별 실제 시각 판별 순수 로직([ISSUE-315]).
 *
 * FCM은 주보 등록 시점에 미리 도착하므로, sermons-v2 이벤트가 사용자 설정과 일치해도 실제
 * 예배 시각이 되기 전까지는 위젯/화면에 반영하면 안 된다. JS `src/utils/worshipSchedule.ts`,
 * iOS `WorshipSermonSync.swift`와 반드시 동일한 스케줄을 유지해야 한다 — 바뀌면 3곳 다 고친다.
 */
object WorshipSchedule {

    private data class Schedule(val isoWeekday: Int, val hour: Int, val minute: Int)

    // JS WORSHIP_SCHEDULE과 동일해야 한다(요일: ISO weekday, 월=1 ... 일=7).
    private val SCHEDULE = mapOf(
        "SAT_1700" to Schedule(isoWeekday = 6, hour = 17, minute = 0),
        "SUN_0950" to Schedule(isoWeekday = 7, hour = 9, minute = 50),
        "SUN_1150" to Schedule(isoWeekday = 7, hour = 11, minute = 50),
        "SUN_1430" to Schedule(isoWeekday = 7, hour = 14, minute = 30),
    )

    private val WEEK_REGEX = Regex("^(\\d{4})-W(\\d{2})$")

    /**
     * week("2026-W37") + worshipType이 가리키는 실제 예배 시작 시각. 해석할 수 없으면 null.
     * zone은 테스트에서 특정 타임존을 고정하기 위한 용도로, 기본값은 기기 로컬 타임존이다.
     */
    fun resolveWorshipDateTime(
        week: String,
        worshipType: String,
        zone: ZoneId = ZoneId.systemDefault(),
    ): Instant? {
        val match = WEEK_REGEX.find(week) ?: return null
        val year = match.groupValues[1].toIntOrNull() ?: return null
        val weekNumber = match.groupValues[2].toIntOrNull() ?: return null
        if (weekNumber < 1 || weekNumber > 53) return null
        val schedule = SCHEDULE[worshipType] ?: return null

        return try {
            val monday = LocalDate.now(zone)
                .with(IsoFields.WEEK_BASED_YEAR, year.toLong())
                .with(IsoFields.WEEK_OF_WEEK_BASED_YEAR, weekNumber.toLong())
                .with(ChronoField.DAY_OF_WEEK, 1L)
            val worshipDate = monday.plusDays((schedule.isoWeekday - 1).toLong())
            worshipDate.atTime(LocalTime.of(schedule.hour, schedule.minute)).atZone(zone).toInstant()
        } catch (e: DateTimeException) {
            null
        }
    }

    /**
     * week/worshipType이 가리키는 예배 시각에 now가 이미 도달했는지 판별한다.
     * week/worshipType 조합을 해석할 수 없으면(방어적으로) true를 반환한다 — JS
     * `hasWorshipTimeArrived`와 동일하게, 판별 불가한 데이터를 영원히 숨기지 않고 기존 동작
     * (즉시 반영)으로 안전하게 폴백한다.
     */
    fun hasWorshipTimeArrived(
        week: String?,
        worshipType: String?,
        now: Instant = Instant.now(),
        zone: ZoneId = ZoneId.systemDefault(),
    ): Boolean {
        if (week.isNullOrEmpty() || worshipType.isNullOrEmpty()) return true
        val scheduled = resolveWorshipDateTime(week, worshipType, zone) ?: return true
        return !now.isBefore(scheduled)
    }
}
