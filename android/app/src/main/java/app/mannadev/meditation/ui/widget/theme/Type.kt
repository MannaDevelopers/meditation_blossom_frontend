package app.mannadev.meditation.ui.widget.theme

import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.sp
import androidx.glance.text.FontWeight
import androidx.glance.text.TextDefaults.defaultTextColor
import androidx.glance.text.TextStyle

/**
 * Glance는 fontSize를 sp로만 받고, 그 sp→px 변환은 앱이 아니라 런처(호스트) 프로세스가
 * RemoteViews를 (재)적용하는 시점에 그때그때의 시스템 fontScale로 수행한다. 따라서 dp로
 * 바꾸거나 LocalDensity를 오버라이드해도 최종 렌더링엔 영향이 없다 — 대신 의도한 크기를
 * 현재 fontScale로 미리 나눠서 넘기면, 호스트가 같은 fontScale을 다시 곱했을 때 상쇄되어
 * 결과적으로 [value]sp 크기로 고정된다([#218]).
 */
fun fixedSp(value: Float, fontScale: Float): TextUnit = (value / fontScale).sp

class Typography(fontScale: Float) {
    val title = TextStyle(
        color = defaultTextColor,
        fontSize = fixedSp(18f, fontScale),
        fontWeight = FontWeight.Bold,
    )
    val verse = TextStyle(
        color = defaultTextColor,
        fontSize = fixedSp(18f, fontScale),
        fontWeight = FontWeight.Normal,
    )
    val book = TextStyle(
        color = defaultTextColor,
        fontSize = fixedSp(14f, fontScale),
        fontWeight = FontWeight.Normal,
    )

    val titleMedium = TextStyle(
        color = defaultTextColor,
        fontSize = fixedSp(16f, fontScale),
        fontWeight = FontWeight.Medium,
    )
    val labelLarge = TextStyle(
        color = defaultTextColor,
        fontSize = fixedSp(14f, fontScale),
        fontWeight = FontWeight.Medium,
    )
    val labelMedium = TextStyle(
        color = defaultTextColor,
        fontSize = fixedSp(12f, fontScale),
        fontWeight = FontWeight.Medium,
    )
    val labelSmall = TextStyle(
        color = defaultTextColor,
        fontSize = fixedSp(11f, fontScale),
        fontWeight = FontWeight.Medium,
    )
    val headlineSmall = TextStyle(
        color = defaultTextColor,
        fontSize = fixedSp(24f, fontScale),
        fontWeight = FontWeight.Normal,
    )
    val bodyMedium = TextStyle(
        color = defaultTextColor,
        fontSize = fixedSp(14f, fontScale),
        fontWeight = FontWeight.Normal,
    )
}
