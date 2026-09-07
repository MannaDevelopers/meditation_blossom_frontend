package app.mannadev.meditation.data

import android.content.Context
import androidx.core.content.edit

private const val PREFS_NAME = "font_scale_prefs"
private const val KEY_LAST_FONT_SCALE = "last_font_scale"
private const val NOT_RECORDED = -1f

/**
 * 위젯이 이미 화면에 떠 있는 상태에서 시스템 글꼴 크기 설정만 바뀌면, 런처가 기존 RemoteViews를
 * 앱의 새 데이터 없이도 자동 재적용하기 때문에 [fixedSp][app.mannadev.meditation.ui.widget.theme.fixedSp]가
 * 계산 당시 굳혀놓은 상쇄 값이 새 fontScale과 어긋난다([#218]). MainActivity가 재실행될 때마다
 * 이전에 기록해둔 값과 비교해 변경 여부를 판단하고, 변경됐다면 위젯을 즉시 갱신해 이 갭을 줄인다.
 * 최초 실행(기록 없음)은 "변경"으로 취급하지 않는다 — 최초 동기화가 이미 현재 fontScale로 이뤄지므로
 * 불필요한 갱신이다.
 */
fun hasFontScaleChanged(current: Float, lastKnown: Float?): Boolean =
    lastKnown != null && lastKnown != current

fun getLastKnownFontScale(context: Context): Float? {
    val value = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).getFloat(KEY_LAST_FONT_SCALE, NOT_RECORDED)
    return if (value == NOT_RECORDED) null else value
}

fun saveLastKnownFontScale(context: Context, value: Float) {
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit {
        putFloat(KEY_LAST_FONT_SCALE, value)
    }
}
