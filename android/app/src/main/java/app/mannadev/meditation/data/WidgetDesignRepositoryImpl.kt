package app.mannadev.meditation.data

import app.mannadev.meditation.domain.repository.WidgetDesignRepository
import app.mannadev.meditation.dto.WidgetDesignDto
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

// [ISSUE-236] 주일 말씀/QT 두 인스턴스로 나뉘어 di/AppModule.kt의 @Provides에서 수동 생성되므로
// @Inject constructor를 쓰지 않는다(싱글턴 스코프는 @Provides @Singleton이 관리). 어느 콘텐츠
// 타입인지는 이 클래스가 알 필요가 없도록, WidgetUpdateNotifier 전체가 아니라 이미 콘텐츠 타입에
// 맞게 골라진 notify 콜백 하나만 주입받는다(@Provides에서 notifySermonDesignChanged/
// notifyQtDesignChanged 중 하나를 람다로 넘김).
class WidgetDesignRepositoryImpl(
    private val prefsSource: WidgetDesignPrefsSource,
    private val onDesignChanged: suspend () -> Unit,
) : WidgetDesignRepository {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val _designState = MutableStateFlow<WidgetDesignDto?>(null)
    override val designState: StateFlow<WidgetDesignDto?> = _designState.asStateFlow()

    init {
        scope.launch { _designState.value = runCatching { prefsSource.getDesign() }.getOrNull() }
    }

    override suspend fun save(dto: WidgetDesignDto): WidgetDesignDto {
        // saveDesign()의 반환값(영구 경로로 치환된 디자인)을 그대로 인메모리 상태에 반영해야 한다 —
        // 전달받은 dto를 그대로 쓰면 갤러리 배경일 때 피커의 임시 캐시 경로가 남아, 위젯이 이미
        // 삭제됐거나 애초에 file:// 스킴이라 BitmapFactory가 못 여는 경로를 참조하게 된다.
        val persisted = prefsSource.saveDesign(dto)
        _designState.value = persisted
        onDesignChanged()
        return persisted
    }

    override suspend fun clear() {
        prefsSource.clearDesign()
        _designState.value = null
        onDesignChanged()
    }
}
