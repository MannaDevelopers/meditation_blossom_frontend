package app.mannadev.meditation.data

import android.content.Context
import androidx.core.content.edit

private const val PREFS_NAME = "app_launch_prefs"
private const val KEY_HAS_LAUNCHED = "has_launched"

/** MainActivity가 최초로 실행됐을 때(사용자가 직접 앱을 연 시점) 한 번 기록한다. */
fun markAppLaunched(context: Context) {
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit {
        putBoolean(KEY_HAS_LAUNCHED, true)
    }
}

/**
 * 위젯이 데이터를 못 가져왔을 때, "메인 앱을 한 번도 연 적 없어서 아직 동기화를 시도할
 * 기회조차 없었던 상태"와 "앱은 열었지만(따라서 최소 한 번은 포그라운드에서 동기화를
 * 시도할 수 있었지만) 어떤 이유로 데이터를 못 가져온 진짜 에러 상태"를 구분하기 위한 신호.
 * 전자는 "앱을 실행해주세요" 안내를, 후자는 "새로고침" 유도 문구를 보여줘야 한다.
 *
 * syncFromRemote() 성공/실패만으로는 이 둘을 구분할 수 없다 — 위젯이 앱 미실행 상태의
 * 백그라운드 프로세스에서 동기화를 시도하면 네트워크 제약으로 실패하는데, 이 실패는
 * "진짜 에러"가 아니라 "아직 제대로 시도할 기회가 없었던 것"에 가깝다.
 */
fun hasAppEverLaunched(context: Context): Boolean =
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).getBoolean(KEY_HAS_LAUNCHED, false)
