package app.mannadev.meditation.data

import app.mannadev.meditation.domain.repository.WidgetDesignRepository
import app.mannadev.meditation.dto.WidgetDesignDto
import app.mannadev.meditation.widget.WidgetUpdateNotifier
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class WidgetDesignRepositoryImpl @Inject constructor(
    private val prefsSource: WidgetDesignPrefsSource,
    private val widgetUpdateNotifier: WidgetUpdateNotifier,
) : WidgetDesignRepository {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val _designState = MutableStateFlow<WidgetDesignDto?>(null)
    override val designState: StateFlow<WidgetDesignDto?> = _designState.asStateFlow()

    init {
        scope.launch { _designState.value = runCatching { prefsSource.getDesign() }.getOrNull() }
    }

    override suspend fun save(dto: WidgetDesignDto) {
        // saveDesign()의 반환값(영구 경로로 치환된 디자인)을 그대로 인메모리 상태에 반영해야 한다 —
        // 전달받은 dto를 그대로 쓰면 갤러리 배경일 때 피커의 임시 캐시 경로가 남아, 위젯이 이미
        // 삭제됐거나 애초에 file:// 스킴이라 BitmapFactory가 못 여는 경로를 참조하게 된다.
        val persisted = prefsSource.saveDesign(dto)
        _designState.value = persisted
        widgetUpdateNotifier.notifyDesignChanged()
    }

    override suspend fun clear() {
        prefsSource.clearDesign()
        _designState.value = null
        widgetUpdateNotifier.notifyDesignChanged()
    }
}
