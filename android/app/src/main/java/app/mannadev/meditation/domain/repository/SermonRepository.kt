package app.mannadev.meditation.domain.repository

import app.mannadev.meditation.dto.SermonDto
import app.mannadev.meditation.model.Sermon
import app.mannadev.meditation.widget.state.WidgetContentState
import kotlinx.coroutines.flow.StateFlow

interface SermonRepository {
    val sermonState: StateFlow<WidgetContentState<Sermon>>
    suspend fun save(dto: SermonDto)
    suspend fun clear()
    /** Firestore에서 최신 설교를 조회해 있으면 저장한다. 조회 실패 시 예외를 던진다(호출자가 재시도 여부 결정). */
    suspend fun syncFromRemote()
}
