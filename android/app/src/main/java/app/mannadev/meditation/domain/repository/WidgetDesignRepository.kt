package app.mannadev.meditation.domain.repository

import app.mannadev.meditation.dto.WidgetDesignDto
import kotlinx.coroutines.flow.StateFlow

interface WidgetDesignRepository {
    /** null이면 사용자가 아직 커스텀 디자인을 저장하지 않은 상태 — 위젯은 기존 하드코딩된 기본 스타일로 렌더링한다. */
    val designState: StateFlow<WidgetDesignDto?>
    suspend fun save(dto: WidgetDesignDto)
    suspend fun clear()
}
