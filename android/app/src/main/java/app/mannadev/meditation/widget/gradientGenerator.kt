package app.mannadev.meditation.widget

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Shader
import androidx.core.graphics.createBitmap

fun createGradientBitmap(
    width: Int,
    height: Int,
    startColor: Int,
    endColor: Int
): Bitmap {
    val bitmap = createBitmap(width, height)
    val canvas = Canvas(bitmap)
    val paint = Paint()

    val gradient = LinearGradient(
        0f, 0f, width.toFloat(), height.toFloat(),
        startColor, endColor,
        Shader.TileMode.CLAMP
    )

    paint.shader = gradient
    canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), paint)
    return bitmap
}