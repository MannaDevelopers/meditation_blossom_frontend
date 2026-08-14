package app.mannadev.meditation.data

import app.mannadev.meditation.dto.WidgetDesignDto

interface WidgetDesignPrefsSource {
    suspend fun getDesign(): WidgetDesignDto?

    /**
     * @return 실제로 저장된 디자인. background.type이 "gallery"면 전달받은 [design]의
     *   background.value(피커가 돌려준 임시 캐시 경로 등)를 그대로 쓰지 않고, 앱 내부 저장소의
     *   고정 경로로 치환한 뒤 그 경로가 담긴 값을 반환한다 — 호출자가 반환값을 인메모리 상태에
     *   반영해야 위젯이 임시 캐시 파일이 아니라 항상 접근 가능한 영구 경로를 참조하게 된다.
     */
    suspend fun saveDesign(design: WidgetDesignDto): WidgetDesignDto
    suspend fun clearDesign()
}
