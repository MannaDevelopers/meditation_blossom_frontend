package app.mannadev.meditation

import android.os.Bundle
import androidx.lifecycle.lifecycleScope
import app.mannadev.meditation.analytics.CrashlyticsHelper
import app.mannadev.meditation.data.getLastKnownFontScale
import app.mannadev.meditation.data.hasFontScaleChanged
import app.mannadev.meditation.data.markAppLaunched
import app.mannadev.meditation.data.saveLastKnownFontScale
import app.mannadev.meditation.di.getWidgetDependencies
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint
import com.facebook.react.defaults.DefaultReactActivityDelegate
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
        // 위젯이 "앱을 한 번도 실행한 적 없어서 아직 동기화를 시도 못 해본 상태"와
        // "앱은 열었지만 데이터를 못 가져온 진짜 에러 상태"를 구분할 수 있도록 기록한다.
        markAppLaunched(this)
        checkFontScaleChangeAndRefreshWidgets()
    }

    // fontScale은 android:configChanges에 없어 앱이 포그라운드에 있는 동안 시스템 글꼴 크기가
    // 바뀌면 Activity가 재생성되어 onCreate가 다시 호출된다 — 이 지점에서 위젯을 즉시 갱신해,
    // 런처가 기존 RemoteViews를 새 fontScale로 재적용할 때 생기는 크기 불일치를 줄인다([#218]).
    // 앱이 완전히 백그라운드/미실행 상태에서 설정이 바뀌는 경우는 다음 실행이나 주기 동기화까지
    // 지연될 수 있다.
    private fun checkFontScaleChangeAndRefreshWidgets() {
        val currentFontScale = resources.configuration.fontScale
        val lastKnownFontScale = getLastKnownFontScale(this)
        if (hasFontScaleChanged(currentFontScale, lastKnownFontScale)) {
            lifecycleScope.launch(Dispatchers.IO) {
                runCatching {
                    getWidgetDependencies(this@MainActivity).widgetUpdateNotifier().notifyFontScaleChanged()
                }.onFailure { e ->
                    CrashlyticsHelper.recordException(e, "MainActivity: failed to refresh widgets after font scale change")
                }
            }
        }
        saveLastKnownFontScale(this, currentFontScale)
    }
}
