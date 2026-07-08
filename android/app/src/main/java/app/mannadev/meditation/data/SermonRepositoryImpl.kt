package app.mannadev.meditation.data

import app.mannadev.meditation.domain.repository.SermonRepository
import app.mannadev.meditation.dto.SermonDto
import app.mannadev.meditation.model.Sermon
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
class SermonRepositoryImpl @Inject constructor(
    private val prefsSource: SermonPrefsSource,
    private val remoteSource: SermonRemoteSource,
    private val widgetUpdateNotifier: WidgetUpdateNotifier,
) : SermonRepository {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val _sermonState =
        MutableStateFlow<WidgetContentState<Sermon>>(WidgetContentState.Loading)
    override val sermonState: StateFlow<WidgetContentState<Sermon>> = _sermonState.asStateFlow()

    init {
        scope.launch { loadFromPrefs() }
    }

    private suspend fun loadFromPrefs() {
        _sermonState.value = runCatching { prefsSource.getDisplaySermon() }
            .fold(
                onSuccess = { dto ->
                    if (dto != null) {
                        WidgetContentState.Data(Sermon.fromDto(dto))
                    } else {
                        WidgetContentState.NoDataYet
                    }
                },
                onFailure = { e -> WidgetContentState.Error(e) },
            )
    }

    override suspend fun save(dto: SermonDto) {
        prefsSource.saveDisplaySermon(dto)
        _sermonState.value = WidgetContentState.Data(Sermon.fromDto(dto))
        widgetUpdateNotifier.notifySermonChanged()
    }

    override suspend fun clear() {
        prefsSource.clearDisplaySermon()
        _sermonState.value = WidgetContentState.NoDataYet
        widgetUpdateNotifier.notifySermonChanged()
    }

    override suspend fun syncFromRemote() {
        val fetched = runCatching { remoteSource.fetchLatestSermon() }
            .onFailure { e ->
                _sermonState.value = WidgetContentState.Error(e)
                widgetUpdateNotifier.notifySermonChanged()
            }
            .getOrThrow()
        if (fetched != null) {
            save(fetched)
        } else {
            _sermonState.value = WidgetContentState.NoDataYet
            widgetUpdateNotifier.notifySermonChanged()
        }
    }
}
