package app.mannadev.meditation.ui.widget

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Shader
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.core.graphics.createBitmap
import androidx.glance.GlanceModifier
import androidx.glance.ImageProvider
import androidx.glance.background
import app.mannadev.meditation.R

/**
 * Creates a bitmap with a linear gradient.
 *
 * @param width The width of the bitmap.
 * @param height The height of the bitmap.
 * @param startColor The starting color of the gradient.
 * @param endColor The ending color of the gradient.
 * @return A [Bitmap] object with the specified gradient.
 */
private fun createGradientBitmap(
    width: Int = 200,
    height: Int = 200,
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

@Composable
fun GlanceModifier.gradientBackground(
    gradientStart: Color,
    gradientEnd: Color
): GlanceModifier {
    val background = remember(gradientStart, gradientEnd) {
        createGradientBitmap(
            startColor = gradientStart.toArgb(),
            endColor = gradientEnd.toArgb()
        )
    }
    return this.background(ImageProvider(background))
}

@Composable
fun GlanceModifier.xmlGradientBackground(): GlanceModifier {
    return this.background(ImageProvider(R.drawable.gradient_background))
}