package app.mannadev.meditation.ui.widget

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color as AndroidColor
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.sp
import androidx.core.graphics.createBitmap
import androidx.glance.text.FontWeight
import androidx.glance.text.TextAlign
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import app.mannadev.meditation.dto.WidgetImageTransformDto
import app.mannadev.meditation.dto.WidgetTextDesignDto
import kotlin.math.roundToInt

/**
 * RN EditScreen에서 저장한 WidgetDesign을 Glance 위젯에 반영하기 위한 변환 유틸.
 * 텍스트/배경 렌더링 규칙은 src/components/WidgetPreview.tsx를 그대로 옮긴 것이라, 둘 중
 * 하나를 바꿀 때는 항상 같이 맞춰야 한다(특히 색상 프리셋, 카드형 이중 레이어 해석 방식).
 */

private fun parseHexColor(hex: String): Color = Color(AndroidColor.parseColor(hex))

// WidgetPreview.tsx의 BANNER_INDEX_SIZE_RATIO/CARD_INDEX_SIZE_RATIO와 동일 — 편집 기능 도입
// 이전 VerseWidgetLarge/Small.kt의 본문:장절 하드코딩 크기 비율(16:12, 14:11)을 그대로 옮긴 값.
const val BANNER_INDEX_SIZE_RATIO = 12f / 16f
const val CARD_INDEX_SIZE_RATIO = 11f / 14f

/**
 * 본문 텍스트 스타일 — 정렬·색상·크기·두께를 모두 디자인값 그대로 반영한다.
 * Glance FontWeight엔 ExtraBold가 없어 "extrabold"는 Bold로 근사한다(RN은 폰트 패밀리를
 * 바꿔 표현하지만, Glance TextStyle은 커스텀 폰트 패밀리를 받지 않는다).
 */
fun WidgetTextDesignDto.toBodyTextStyle(): TextStyle = TextStyle(
    color = ColorProvider(parseHexColor(color)),
    fontSize = size.sp,
    fontWeight = if (weight == "regular") FontWeight.Normal else FontWeight.Bold,
    textAlign = when (align) {
        "center" -> TextAlign.Center
        "right" -> TextAlign.Right
        else -> TextAlign.Left
    },
)

/**
 * 제목 텍스트 스타일 — 색상·크기만 디자인값을 따르고, 두께/정렬은 기존처럼 고정한다.
 * (WidgetPreview.tsx의 bannerTitle/cardTitle 스타일이 textStyle 전체가 아니라 color/fontSize만
 * 개별로 덮어쓰는 것과 동일한 규칙 — weight는 본문에만 적용된다는 [#169]의 설계 결정.)
 */
fun WidgetTextDesignDto.toTitleTextStyle(fixedWeight: FontWeight): TextStyle = TextStyle(
    color = ColorProvider(parseHexColor(color)),
    fontSize = size.sp,
    fontWeight = fixedWeight,
    textAlign = TextAlign.Left,
)

/**
 * 장절 표기(색인) 텍스트 스타일 — 편집 기능 도입 이전 하드코딩 스타일에서도 항상 본문보다
 * 작았다(VerseWidgetLarge: 본문 16sp/장절 12sp, VerseWidgetSmall: 본문 14sp/장절 11sp). 본문
 * 크기를 사용자가 조절해도 이 비율이 유지되도록, 본문 스타일을 그대로 쓰지 않고 색상+비례
 * 축소된 크기만 따로 적용한다(제목과 동일한 패턴). ratio는 WidgetPreview.tsx의
 * BANNER_INDEX_SIZE_RATIO/CARD_INDEX_SIZE_RATIO와 동일해야 한다.
 */
fun WidgetTextDesignDto.toIndexTextStyle(ratio: Float): TextStyle = TextStyle(
    color = ColorProvider(parseHexColor(color)),
    fontSize = (size * ratio).let { Math.round(it) }.sp,
)

// 카드형(Small) 위젯의 이중 레이어 재해석([#169] 3.7절, src/utils/widgetDesignColor.ts와 동일 로직)
// — 배경색의 제목 영역을 "같은 색조·채도, 더 밝은(또는 이미 밝으면 더 어두운) 명도"로 계산한다.
fun cardOuterTintColor(hex: String, deltaLightnessPoints: Float = 22f, maxLightness: Float = 95f): Color {
    val rgb = AndroidColor.parseColor(hex)
    val (h, s, l) = rgbToHsl(AndroidColor.red(rgb), AndroidColor.green(rgb), AndroidColor.blue(rgb))
    val direction = if (l > 70f) -1f else 1f
    val nextL = (l + direction * deltaLightnessPoints).coerceAtMost(maxLightness).coerceAtLeast(0f)
    val (r, g, b) = hslToRgb(h, s, nextL)
    return Color(AndroidColor.rgb(r, g, b))
}

private fun rgbToHsl(r: Int, g: Int, b: Int): Triple<Float, Float, Float> {
    val rNorm = r / 255f
    val gNorm = g / 255f
    val bNorm = b / 255f
    val max = maxOf(rNorm, gNorm, bNorm)
    val min = minOf(rNorm, gNorm, bNorm)
    var h = 0f
    var s = 0f
    val l = (max + min) / 2f

    if (max != min) {
        val d = max - min
        s = if (l > 0.5f) d / (2f - max - min) else d / (max + min)
        h = when (max) {
            rNorm -> (gNorm - bNorm) / d + (if (gNorm < bNorm) 6f else 0f)
            gNorm -> (bNorm - rNorm) / d + 2f
            else -> (rNorm - gNorm) / d + 4f
        }
        h /= 6f
    }
    return Triple(h * 360f, s * 100f, l * 100f)
}

private fun hue2rgb(p: Float, q: Float, t: Float): Float {
    var tNorm = t
    if (tNorm < 0f) tNorm += 1f
    if (tNorm > 1f) tNorm -= 1f
    return when {
        tNorm < 1f / 6f -> p + (q - p) * 6f * tNorm
        tNorm < 1f / 2f -> q
        tNorm < 2f / 3f -> p + (q - p) * (2f / 3f - tNorm) * 6f
        else -> p
    }
}

private fun hslToRgb(h: Float, s: Float, l: Float): Triple<Int, Int, Int> {
    val hNorm = h / 360f
    val sNorm = s / 100f
    val lNorm = l / 100f
    if (sNorm == 0f) {
        val gray = (lNorm * 255f).toInt()
        return Triple(gray, gray, gray)
    }
    val q = if (lNorm < 0.5f) lNorm * (1f + sNorm) else lNorm + sNorm - lNorm * sNorm
    val p = 2f * lNorm - q
    val r = (hue2rgb(p, q, hNorm + 1f / 3f) * 255f).toInt()
    val g = (hue2rgb(p, q, hNorm) * 255f).toInt()
    val b = (hue2rgb(p, q, hNorm - 1f / 3f) * 255f).toInt()
    return Triple(r, g, b)
}

/**
 * 갤러리 배경 이미지를 지정한 캔버스 크기에 zoom/focalX/focalY 기준으로 cover-fit 배치해
 * 하나의 Bitmap으로 구워낸다 — src/utils/imageCropMath.ts(computeBaseScale/clampFocal)와
 * src/components/WidgetPreview.tsx(useGalleryImageLayout)의 계산을 그대로 옮긴 것이다.
 * Glance는 `.background(ImageProvider(bitmap))`을 실제 위젯 크기에 맞춰 늘려 채우므로,
 * 위젯이 리사이즈되어도 이 함수가 만든 고정 해상도 비트맵 하나로 충분하다(기존
 * gradientBackground.kt의 고정 200x200 그라데이션 비트맵과 동일한 전략).
 */
fun decodeGalleryBitmap(
    path: String,
    transform: WidgetImageTransformDto?,
    canvasWidth: Int,
    canvasHeight: Int,
): Bitmap? {
    val source = decodeSampledBitmap(path, canvasWidth, canvasHeight) ?: return null
    val output = createBitmap(canvasWidth, canvasHeight)
    val canvas = Canvas(output)

    val zoom = (transform?.zoom ?: 1.0).toFloat()
    val baseScale = maxOf(
        canvasWidth.toFloat() / source.width,
        canvasHeight.toFloat() / source.height,
    )
    val scale = baseScale * zoom
    val displayedWidth = source.width * scale
    val displayedHeight = source.height * scale

    val halfExtentX = if (displayedWidth <= 0f) 0.5f else (canvasWidth / 2f) / displayedWidth
    val halfExtentY = if (displayedHeight <= 0f) 0.5f else (canvasHeight / 2f) / displayedHeight
    val focalX = clampFocal((transform?.focalX ?: 0.5).toFloat(), halfExtentX)
    val focalY = clampFocal((transform?.focalY ?: 0.5).toFloat(), halfExtentY)

    val left = canvasWidth / 2f - focalX * displayedWidth
    val top = canvasHeight / 2f - focalY * displayedHeight

    val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
    canvas.drawBitmap(source, null, RectF(left, top, left + displayedWidth, top + displayedHeight), paint)
    source.recycle()
    return output
}

/**
 * 카드형(Small) 갤러리 배경 — [decodeGalleryBitmap]으로 cover-fit 크롭한 사진 위에, 안쪽 카드
 * 창(둥근 사각형) 자리만 비우고 나머지("액자") 영역엔 반투명 흰색을 입힌 도넛 마스크를 구워
 * 하나의 비트맵으로 합성한다. src/components/WidgetPreview.tsx의 CardPhotoFrame(SVG
 * mask="url(#cardPhotoFrameMask)")과 동일한 결과를 Path.Op.DIFFERENCE로 재현한 것 —
 * Glance는 임의 형태 클리핑/오버레이를 지원하지 않아 배경 자체에 마스크를 구워 넣어야 한다.
 * inner*는 실제 VerseWidgetSmall.kt 레이아웃에서 안쪽 카드 Box가 놓이는 위치(픽셀)와 맞아야
 * 이 마스크의 "구멍"이 그 Box와 정확히 겹쳐 보인다.
 */
fun decodeGalleryCardBitmap(
    path: String,
    transform: WidgetImageTransformDto?,
    canvasWidth: Int,
    canvasHeight: Int,
    innerLeft: Float,
    innerTop: Float,
    innerRight: Float,
    innerBottom: Float,
    outerCornerRadius: Float,
    innerCornerRadius: Float,
    tintOpacity: Float,
): Bitmap? {
    val bitmap = decodeGalleryBitmap(path, transform, canvasWidth, canvasHeight) ?: return null
    val canvas = Canvas(bitmap)

    val outerPath = Path().apply {
        addRoundRect(
            RectF(0f, 0f, canvasWidth.toFloat(), canvasHeight.toFloat()),
            outerCornerRadius,
            outerCornerRadius,
            Path.Direction.CW,
        )
    }
    val innerPath = Path().apply {
        addRoundRect(
            RectF(innerLeft, innerTop, innerRight, innerBottom),
            innerCornerRadius,
            innerCornerRadius,
            Path.Direction.CW,
        )
    }
    val donutPath = Path().apply { op(outerPath, innerPath, Path.Op.DIFFERENCE) }

    val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = AndroidColor.WHITE
        alpha = (tintOpacity * 255f).roundToInt()
    }
    canvas.drawPath(donutPath, paint)
    return bitmap
}

private fun clampFocal(value: Float, halfExtent: Float): Float {
    if (halfExtent >= 0.5f) return 0.5f
    return value.coerceIn(halfExtent, 1f - halfExtent)
}

private fun decodeSampledBitmap(path: String, reqWidth: Int, reqHeight: Int): Bitmap? {
    return try {
        val boundsOptions = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(path, boundsOptions)
        if (boundsOptions.outWidth <= 0 || boundsOptions.outHeight <= 0) return null

        val decodeOptions = BitmapFactory.Options().apply {
            inSampleSize = calculateInSampleSize(boundsOptions, reqWidth, reqHeight)
        }
        BitmapFactory.decodeFile(path, decodeOptions)
    } catch (e: Exception) {
        null
    }
}

private fun calculateInSampleSize(options: BitmapFactory.Options, reqWidth: Int, reqHeight: Int): Int {
    val height = options.outHeight
    val width = options.outWidth
    var inSampleSize = 1
    if (height > reqHeight || width > reqWidth) {
        val halfHeight = height / 2
        val halfWidth = width / 2
        while (halfHeight / inSampleSize >= reqHeight && halfWidth / inSampleSize >= reqWidth) {
            inSampleSize *= 2
        }
    }
    return inSampleSize
}
