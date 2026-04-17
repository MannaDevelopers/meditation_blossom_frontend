package app.mannadev.meditation.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class QtDto(
    val date: String,                 // "YYYY-MM-DD"
    val title: String,
    @SerialName("series_title")
    val seriesTitle: String,
    val content: String,              // resolved (as per BibleReferenceResolver output)
    @SerialName("day_of_week")
    val dayOfWeek: String,
)
