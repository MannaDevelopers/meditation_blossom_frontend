package app.mannadev.meditation.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class VerseDto(
    val date:String,
    val title:String,
    val content:String,
    @SerialName("day_of_week")
    val dayOfWeek:String,
)