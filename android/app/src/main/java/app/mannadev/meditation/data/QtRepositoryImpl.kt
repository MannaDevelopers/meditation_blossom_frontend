package app.mannadev.meditation.data

import app.mannadev.meditation.domain.repository.QtRepository
import app.mannadev.meditation.dto.QtDto
import app.mannadev.meditation.widget.WidgetUpdateNotifier
import app.mannadev.meditation.widget.state.WidgetContentState
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
class QtRepositoryImpl @Inject constructor(
    private val prefsSource: QtPrefsSource,
    private val remoteSource: QtRemoteSource,
    private val widgetUpdateNotifier: WidgetUpdateNotifier,
    private val appLaunchState: AppLaunchState,
) : QtRepository {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val _qtState =
        MutableStateFlow<WidgetContentState<QtDto>>(WidgetContentState.Loading)
    override val qtState: StateFlow<WidgetContentState<QtDto>> = _qtState.asStateFlow()

    init {
        scope.launch { loadFromPrefs() }
    }

    private suspend fun loadFromPrefs() {
        _qtState.value = runCatching { prefsSource.getDisplayQt() }
            .fold(
                onSuccess = { dto ->
                    if (dto != null) {
                        WidgetContentState.Data(dto)
                    } else {
                        WidgetContentState.NoDataYet(appLaunchState.hasEverLaunched())
                    }
                },
                onFailure = { e -> WidgetContentState.Error(e) },
            )
    }

    override suspend fun save(dto: QtDto) {
        prefsSource.saveDisplayQt(dto)
        _qtState.value = WidgetContentState.Data(dto)
        widgetUpdateNotifier.notifyQtChanged()
    }

    override suspend fun clear() {
        prefsSource.clearDisplayQt()
        _qtState.value = WidgetContentState.NoDataYet(appLaunchState.hasEverLaunched())
        widgetUpdateNotifier.notifyQtChanged()
    }

    override suspend fun syncFromRemote() {
        val fetched = remoteSource.fetchLatestQt()
        if (fetched != null) {
            save(fetched)
        }
    }
}
