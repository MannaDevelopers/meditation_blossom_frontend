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
        prefsSource.saveDesign(dto)
        _designState.value = dto
        widgetUpdateNotifier.notifyDesignChanged()
    }

    override suspend fun clear() {
        prefsSource.clearDesign()
        _designState.value = null
        widgetUpdateNotifier.notifyDesignChanged()
    }
}
