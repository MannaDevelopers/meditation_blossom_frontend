package app.mannadev.meditation.ui.widget.qt

import app.mannadev.meditation.dto.QtDto
import app.mannadev.meditation.dto.SermonDto
import app.mannadev.meditation.model.VerseParser
import java.text.SimpleDateFormat
import java.util.Locale

data class QtWidgetUiModel(
    val title: String,
    val dateLabel: String,        // "화 · 4월 26일"
    val reference: String,        // "에베소서 5:15-16"
    val verses: List<String>,
    val questions: List<String>,
    val videoUrl: String?,
) {
    companion object {
        val error: QtWidgetUiModel = QtWidgetUiModel(
            title = "QT를 불러오지 못했습니다",
            dateLabel = "",
            reference = "",
            verses = emptyList(),
            questions = emptyList(),
            videoUrl = null,
        )

        fun fromDto(dto: QtDto): QtWidgetUiModel {
            val titleMerged = if (dto.seriesTitle.isNotBlank())
                "${dto.seriesTitle} / ${dto.title}" else dto.title

            val parsed = runCatching {
                VerseParser.parse(
                    SermonDto(
                        date = dto.date,
                        title = titleMerged,
                        content = dto.content,
                        dayOfWeek = dto.dayOfWeek,
                        videoUrl = dto.videoUrl,
                    )
                )
            }.getOrNull()

            return QtWidgetUiModel(
                title = titleMerged,
                dateLabel = formatDateLabel(dto.date, dto.dayOfWeek),
                reference = parsed?.bookName.orEmpty(),
                verses = parsed?.verses ?: listOf(dto.content),
                questions = dto.meditationQuestions,
                videoUrl = dto.videoUrl,
            )
        }
    }
}

private val DATE_INPUT_FORMAT = SimpleDateFormat("yyyy-MM-dd", Locale.KOREA)
private val DATE_OUTPUT_FORMAT = SimpleDateFormat("M월 d일", Locale.KOREA)

private val DAY_OF_WEEK_KO = mapOf(
    "MON" to "월", "TUE" to "화", "WED" to "수", "THU" to "목",
    "FRI" to "금", "SAT" to "토", "SUN" to "일",
)

internal fun formatDateLabel(date: String, dayOfWeek: String): String {
    val day = DAY_OF_WEEK_KO[dayOfWeek.uppercase(Locale.ROOT)] ?: return ""
    val parsedDate = runCatching { DATE_INPUT_FORMAT.parse(date) }.getOrNull() ?: return day
    return "$day · ${DATE_OUTPUT_FORMAT.format(parsedDate)}"
}
