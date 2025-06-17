package app.mannadev.meditation.ui.widget.theme

import androidx.compose.ui.unit.sp
import androidx.glance.text.FontWeight
import androidx.glance.text.TextDefaults.defaultTextColor
import androidx.glance.text.TextStyle

object Typography {
    val title = TextStyle(
        color = defaultTextColor,
        fontSize = 18.sp,
        fontWeight = FontWeight.Bold,
    )
    val verse = TextStyle(
        color = defaultTextColor,
        fontSize = 18.sp,
        fontWeight = FontWeight.Normal,
    )
    val book = TextStyle(
        color = defaultTextColor,
        fontSize = 14.sp,
        fontWeight = FontWeight.Normal,
    )

    val titleMedium = TextStyle(
        color = defaultTextColor,
        fontSize = 16.sp,
        fontWeight = FontWeight.Medium,
    )
    val labelLarge = TextStyle(
        color = defaultTextColor,
        fontSize = 14.sp,
        fontWeight = FontWeight.Medium,
    )
    val labelMedium = TextStyle(
        color = defaultTextColor,
        fontSize = 12.sp,
        fontWeight = FontWeight.Medium,
    )
    val labelSmall = TextStyle(
        color = defaultTextColor,
        fontSize = 11.sp,
        fontWeight = FontWeight.Medium,
    )
    val headlineSmall = TextStyle(
        color = defaultTextColor,
        fontSize = 24.sp,
        fontWeight = FontWeight.Normal,
    )
    val bodyMedium = TextStyle(
        color = defaultTextColor,
        fontSize = 14.sp,
        fontWeight = FontWeight.Normal,
    )
}