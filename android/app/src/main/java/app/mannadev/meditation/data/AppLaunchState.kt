package app.mannadev.meditation.data

import android.content.Context
import androidx.core.content.edit
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

private const val PREFS_NAME = "app_launch_prefs"
private const val KEY_HAS_LAUNCHED = "has_launched"

/** MainActivity가 최초로 실행됐을 때(사용자가 직접 앱을 연 시점) 한 번 기록한다. */
fun markAppLaunched(context: Context) {
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit {
        putBoolean(KEY_HAS_LAUNCHED, true)
    }
}

/**
 * 위젯이 데이터를 못 가져왔을 때, "메인 앱을 한 번도 연 적 없어서 아직 활성화 전인 상태"와
 * "앱은 열었지만 어떤 이유로 데이터를 못 가져온 진짜 에러 상태"를 구분하기 위한 신호.
 * 전자는 안내 문구를, 후자는 새로고침 유도 문구를 보여줘야 한다.
 */
fun hasAppEverLaunched(context: Context): Boolean =
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).getBoolean(KEY_HAS_LAUNCHED, false)

/** Repository가 실제 Context 없이 단위 테스트 가능하도록 감싼 인터페이스. */
interface AppLaunchState {
    fun hasEverLaunched(): Boolean
}

@Singleton
class AppLaunchStateImpl @Inject constructor(
    @ApplicationContext private val context: Context,
) : AppLaunchState {
    override fun hasEverLaunched(): Boolean = hasAppEverLaunched(context)
}
