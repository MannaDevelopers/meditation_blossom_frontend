package app.mannadev.meditation

import android.os.Bundle
import app.mannadev.meditation.data.markAppLaunched
import app.mannadev.meditation.di.getWidgetDependencies
import app.mannadev.meditation.widget.enqueueWidgetInitialSync
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint
import com.facebook.react.defaults.DefaultReactActivityDelegate
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class MainActivity : ReactActivity() {

    override fun getMainComponentName(): String = "meditation_blossom"

    override fun createReactActivityDelegate(): ReactActivityDelegate =
        DefaultReactActivityDelegate(
            this,
            mainComponentName,
            DefaultNewArchitectureEntryPoint.fabricEnabled
        )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(null)
        markAppLaunched(this)
        // 위젯을 앱 미실행 상태로 선설치하면 설치 시점(onEnabled/provideGlance)의 Firestore
        // fallback이 백그라운드 실행 제한으로 서버에 못 닿아 빈 캐시만 받고 안내 문구에 머문다.
        // 앱을 실제로 연 이 시점(foreground)에는 조회가 성공하므로, 동일한 초기 동기화 worker를
        // 여기서 한 번 더 발동해 remote fetch → prefs 저장 → 위젯 재렌더 경로를 확실히 태운다.
        enqueueWidgetInitialSync(this)
    }

    override fun onStart() {
        super.onStart()
        // 위젯 탭 등으로 앱이 warm 진입하면 onCreate가 다시 호출되지 않는다. 위젯은
        // Repository의 StateFlow를 collectAsState()로 구독하므로, 여기서는 Glance 세션을
        // 여는 것(updateAll 1회)만 하면 된다 — 세션이 열리는 순간 현재 state를 그대로 반영한다.
        val notifier = getWidgetDependencies(this).widgetUpdateNotifier()
        CoroutineScope(Dispatchers.Default).launch {
            notifier.notifySermonChanged()
            notifier.notifyQtChanged()
        }
    }
}
