package app.mannadev.meditation.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class SermonDto(
    val date:String, // ISO 8601 date format, e.g., "2023-10-01"
    val title:String,
    val content:String,
    @SerialName("day_of_week")
    val dayOfWeek:String,
)