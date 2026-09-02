package app.mannadev.meditation.domain.repository

import app.mannadev.meditation.dto.WidgetDesignDto
import kotlinx.coroutines.flow.StateFlow

interface WidgetDesignRepository {
    /** null이면 사용자가 아직 커스텀 디자인을 저장하지 않은 상태 — 위젯은 기존 하드코딩된 기본 스타일로 렌더링한다. */
    val designState: StateFlow<WidgetDesignDto?>
    /** 갤러리 배경이면 영구 저장 경로로 치환된 DTO를 반환한다 — 호출부(RN 브릿지)가 이 값을
     * 그대로 돌려줘야 RN이 피커의 임시 캐시 경로 대신 안정적인 경로를 캐싱할 수 있다. */
    suspend fun save(dto: WidgetDesignDto): WidgetDesignDto
    suspend fun clear()
}
