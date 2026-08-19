package app.mannadev.meditation.widget

import android.content.Context
import androidx.glance.appwidget.updateAll
import app.mannadev.meditation.analytics.AnalyticsHelper
import app.mannadev.meditation.analytics.CrashlyticsHelper
import app.mannadev.meditation.ui.widget.QtWidgetLarge
import app.mannadev.meditation.ui.widget.QtWidgetSmall
import app.mannadev.meditation.ui.widget.VerseWidgetLarge
import app.mannadev.meditation.ui.widget.VerseWidgetSmall
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class WidgetUpdateNotifierImpl @Inject constructor(
    @ApplicationContext private val context: Context,
) : WidgetUpdateNotifier {

    override suspend fun notifySermonChanged() {
        runCatching {
            VerseWidgetLarge().updateAll(context)
            VerseWidgetSmall().updateAll(context)
            AnalyticsHelper.logWidgetUpdated("verse_large")
            AnalyticsHelper.logWidgetUpdated("verse_small")
        }.onFailure { e ->
            CrashlyticsHelper.recordException(e, "WidgetUpdateNotifier: failed to update sermon widgets")
        }
    }

    override suspend fun notifyQtChanged() {
        runCatching {
            QtWidgetLarge().updateAll(context)
            QtWidgetSmall().updateAll(context)
            AnalyticsHelper.logWidgetUpdated("qt_large")
            AnalyticsHelper.logWidgetUpdated("qt_small")
        }.onFailure { e ->
            CrashlyticsHelper.recordException(e, "WidgetUpdateNotifier: failed to update QT widgets")
        }
    }

    // VerseWidget*는 [#217]에서 저장된 디자인을 실제로 반영하도록 구현됨.
    override suspend fun notifySermonDesignChanged() {
        runCatching {
            VerseWidgetLarge().updateAll(context)
            VerseWidgetSmall().updateAll(context)
            AnalyticsHelper.logWidgetUpdated("design_verse_large")
            AnalyticsHelper.logWidgetUpdated("design_verse_small")
        }.onFailure { e ->
            CrashlyticsHelper.recordException(e, "WidgetUpdateNotifier: failed to update sermon widgets after design change")
        }
    }

    // QtWidget*는 아직 저장된 디자인을 읽지 않아(QT 전용 렌더링 반영은 [ISSUE-236]과 별도 후속
    // 이슈) 지금은 시각적 변화 없는 안전한 recompose 트리거일 뿐이다.
    override suspend fun notifyQtDesignChanged() {
        runCatching {
            QtWidgetLarge().updateAll(context)
            QtWidgetSmall().updateAll(context)
            AnalyticsHelper.logWidgetUpdated("design_qt_large")
            AnalyticsHelper.logWidgetUpdated("design_qt_small")
        }.onFailure { e ->
            CrashlyticsHelper.recordException(e, "WidgetUpdateNotifier: failed to update QT widgets after design change")
        }
    }
}
