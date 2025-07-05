package app.mannadev.meditation.utils

import java.time.DayOfWeek
import java.time.LocalDate

fun LocalDate.getPreviousOrCurrentSaturday(): LocalDate {
    var targetDate = this
    // 오늘이 토요일이 아닌 경우, 가장 가까운 과거의 토요일로 설정
    if (this.dayOfWeek != DayOfWeek.SATURDAY) {
        targetDate = this.minusDays(this.dayOfWeek.value.toLong() % 7)
    }
    return targetDate
}