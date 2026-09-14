package app.mannadev.meditation.widget

interface WidgetUpdateNotifier {
    suspend fun notifySermonChanged()
    suspend fun notifyQtChanged()
    suspend fun notifySermonDesignChanged()
    suspend fun notifyQtDesignChanged()

    // 시스템 글꼴 크기는 콘텐츠 종류와 무관하게 4개 위젯 전체의 렌더링에 영향을 주므로,
    // 다른 notify*와 달리 콘텐츠별로 나누지 않고 한 번에 전부 갱신한다([#218]).
    suspend fun notifyFontScaleChanged()
}
