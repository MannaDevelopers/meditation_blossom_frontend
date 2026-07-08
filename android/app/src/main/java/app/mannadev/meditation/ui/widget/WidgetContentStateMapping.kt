package app.mannadev.meditation.ui.widget

import app.mannadev.meditation.model.Sermon
import app.mannadev.meditation.widget.state.WidgetContentState

/**
 * 어떤 state든 기존 Content Composable로 그릴 수 있는 [Sermon]으로 변환한다.
 * NoDataYet/Error/Loading도 항상 clickAction이 붙은 정상 Composable 경로를 타므로,
 * 과거 errorUiLayout(네이티브 XML, 클릭 불가)로 빠지는 경로 자체가 없어진다.
 */
fun WidgetContentState<Sermon>.toDisplaySermon(): Sermon = when (this) {
    is WidgetContentState.Data -> value
    is WidgetContentState.Loading -> Sermon.noData(hasAppEverLaunched = false)
    is WidgetContentState.NoDataYet -> Sermon.noData(hasAppEverLaunched)
    is WidgetContentState.Error -> Sermon.errorSermon
}
