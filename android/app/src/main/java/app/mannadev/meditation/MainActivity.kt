package app.mannadev.meditation

import android.os.Bundle
import app.mannadev.meditation.data.markAppLaunched
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint
import com.facebook.react.defaults.DefaultReactActivityDelegate

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
    }
}
