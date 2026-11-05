package app.mannadev.meditation

import android.app.Application
import app.mannadev.meditation.analytics.CrashlyticsHelper
import app.mannadev.meditation.rnmodule.MyReactPackage
import app.mannadev.meditation.widget.enqueueWidgetPeriodicSync
import app.mannadev.meditation.widget.registerWidgetRefreshReceiver
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.google.firebase.messaging.FirebaseMessaging
import dagger.hilt.android.HiltAndroidApp
import timber.log.Timber

@HiltAndroidApp
class MainApplication : Application(), ReactApplication {

    // RN 0.88 템플릿 방식: ReactNativeHost 없이 ReactHost만 만든다(진입 모듈 "index",
    // 개발 지원은 디버그 빌드에서만 — getDefaultReactHost 기본값과 기존 설정이 같다).
    override val reactHost: ReactHost by lazy {
        getDefaultReactHost(
            context = applicationContext,
            packageList =
                PackageList(this).packages.apply {
                    // 자동 링크되지 않는 앱 자체 네이티브 모듈
                    add(MyReactPackage())
                },
        )
    }

    override fun onCreate() {
        super.onCreate()
        // SoLoader 초기화 + New Architecture 진입점 로드(자동 생성 코드, 기존 수동 호출을 대체)
        loadReactNative(this)
        if (BuildConfig.DEBUG) {
            Timber.plant(Timber.DebugTree())
        }

        // 위젯 FCM push 누락 대비 1일 1회 안전망 동기화 등록 (멱등)
        enqueueWidgetPeriodicSync(this)

        // 폴드 펼침/화면 켜짐/잠금 해제 시 위젯 즉시 갱신 ([ISSUE-331])
        registerWidgetRefreshReceiver(this)

        // 기존 토픽 구독 해제 (중복 알림 방지)
        FirebaseMessaging.getInstance()
            .unsubscribeFromTopic(Constants.SERMON_SUBJECT)
            .addOnCompleteListener { task ->
                task.exception?.let { exception ->
                    CrashlyticsHelper.recordException(
                        exception,
                        "FirebaseMessaging unsubscribeFromTopic failed"
                    )
                } ?: run {
                    Timber.d("Successfully unsubscribed from ${Constants.SERMON_SUBJECT} topic")
                }
            }

        // 새 Sermon 토픽 구독
        FirebaseMessaging.getInstance()
            .subscribeToTopic(Constants.SERMON_SUBJECT_V2)
            .addOnCompleteListener { task ->
                task.exception?.let { exception ->
                    CrashlyticsHelper.recordException(
                        exception,
                        "FirebaseMessaging subscribeToTopic (sermon_events_v2) failed"
                    )
                } ?: run {
                    Timber.d("Successfully subscribed to ${Constants.SERMON_SUBJECT_V2} topic")
                }
            }

        // sermons-v2(예배 시간별 주간 데이터) 토픽 구독
        FirebaseMessaging.getInstance()
            .subscribeToTopic(Constants.SERMONS_V2_SUBJECT)
            .addOnCompleteListener { task ->
                task.exception?.let { exception ->
                    CrashlyticsHelper.recordException(
                        exception,
                        "FirebaseMessaging subscribeToTopic (sermons_v2_events) failed"
                    )
                } ?: run {
                    Timber.d("Successfully subscribed to ${Constants.SERMONS_V2_SUBJECT} topic")
                }
            }

        // 새 QT 토픽 구독
        FirebaseMessaging.getInstance()
            .subscribeToTopic(Constants.QT_SUBJECT)
            .addOnCompleteListener { task ->
                task.exception?.let { exception ->
                    CrashlyticsHelper.recordException(
                        exception,
                        "FirebaseMessaging subscribeToTopic (qt_events) failed"
                    )
                } ?: run {
                    Timber.d("Successfully subscribed to ${Constants.QT_SUBJECT} topic")
                }
            }
        
        // DEBUG 모드에서만 _test 토픽 처리
        if (BuildConfig.DEBUG) {
            FirebaseMessaging.getInstance()
                .unsubscribeFromTopic("sermon_events_test")

            FirebaseMessaging.getInstance()
                .subscribeToTopic("sermon_events_v2_test")
                .addOnCompleteListener { task ->
                    task.exception?.let { exception ->
                        CrashlyticsHelper.recordException(
                            exception,
                            "FirebaseMessaging subscribeToTopic (sermon_events_v2_test) failed"
                        )
                    } ?: run {
                        Timber.d("[DEBUG] Successfully subscribed to sermon_events_v2_test topic")
                    }
                }

            FirebaseMessaging.getInstance()
                .subscribeToTopic("qt_events_test")
                .addOnCompleteListener { task ->
                    task.exception?.let { exception ->
                        CrashlyticsHelper.recordException(
                            exception,
                            "FirebaseMessaging subscribeToTopic (qt_events_test) failed"
                        )
                    } ?: run {
                        Timber.d("[DEBUG] Successfully subscribed to qt_events_test topic")
                    }
                }

            FirebaseMessaging.getInstance()
                .subscribeToTopic("sermons_v2_events_test")
                .addOnCompleteListener { task ->
                    task.exception?.let { exception ->
                        CrashlyticsHelper.recordException(
                            exception,
                            "FirebaseMessaging subscribeToTopic (sermons_v2_events_test) failed"
                        )
                    } ?: run {
                        Timber.d("[DEBUG] Successfully subscribed to sermons_v2_events_test topic")
                    }
                }
        }

    }
}