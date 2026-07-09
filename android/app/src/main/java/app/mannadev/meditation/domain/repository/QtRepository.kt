package app.mannadev.meditation.domain.repository

import app.mannadev.meditation.dto.QtDto
import app.mannadev.meditation.widget.state.WidgetContentState
import kotlinx.coroutines.flow.StateFlow

interface QtRepository {
    val qtState: StateFlow<WidgetContentState<QtDto>>
    suspend fun save(dto: QtDto)
    suspend fun clear()
    suspend fun syncFromRemote()
}
