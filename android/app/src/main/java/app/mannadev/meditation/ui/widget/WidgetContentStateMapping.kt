package app.mannadev.meditation.ui.widget

import app.mannadev.meditation.dto.QtDto
import app.mannadev.meditation.model.Sermon
import app.mannadev.meditation.ui.widget.qt.QtWidgetUiModel
import app.mannadev.meditation.widget.state.WidgetContentState

/**
 * 어떤 state든 기존 Content Composable로 그릴 수 있는 [Sermon]으로 변환한다.
 * NoDataYet/Error/Loading도 항상 clickAction이 붙은 정상 Composable 경로를 타므로,
 * 과거 errorUiLayout(네이티브 XML, 클릭 불가)로 빠지는 경로 자체가 없어진다.
 *
 * @param hasAppEverLaunched 메인 앱을 한 번이라도 실행한 적이 있는지. false면 아직
 * 포그라운드에서 동기화를 시도할 기회조차 없었다는 뜻이므로 Data가 아닌 모든 상태를
 * "최초 실행 안내"로 보여준다. true면 Error/NoDataYet을 "새로고침 유도" 문구로 보여준다.
 * (syncFromRemote()의 성공/실패만으로는 "아직 시도 안 해봄"과 "시도했지만 실패"를
 * 구분할 수 없다 — 앱 미실행 상태의 백그라운드 동기화는 네트워크 제약으로 항상
 * 실패하지만, 이는 진짜 에러가 아니다.)
 */
fun WidgetContentState<Sermon>.toDisplaySermon(hasAppEverLaunched: Boolean): Sermon = when (this) {
    is WidgetContentState.Data -> value
    is WidgetContentState.Loading -> Sermon.noData
    is WidgetContentState.NoDataYet, is WidgetContentState.Error ->
        if (hasAppEverLaunched) Sermon.errorSermon else Sermon.noData
}

/**
 * 어떤 state든 기존 Content Composable로 그릴 수 있는 [QtWidgetUiModel]로 변환한다.
 * Sermon과 동일하게 NoDataYet/Error/Loading도 항상 clickAction이 붙은 정상 Composable
 * 경로를 타므로, 과거 errorUiLayout(네이티브 XML, 클릭 불가)로 빠지는 경로 자체가 없어진다.
 *
 * @param hasAppEverLaunched [toDisplaySermon]과 동일한 목적.
 */
fun WidgetContentState<QtDto>.toDisplayQtUiModel(hasAppEverLaunched: Boolean): QtWidgetUiModel = when (this) {
    is WidgetContentState.Data -> QtWidgetUiModel.fromDto(value)
    is WidgetContentState.Loading -> QtWidgetUiModel.noData
    is WidgetContentState.NoDataYet, is WidgetContentState.Error ->
        if (hasAppEverLaunched) QtWidgetUiModel.error else QtWidgetUiModel.noData
}
