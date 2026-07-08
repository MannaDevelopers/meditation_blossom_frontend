package app.mannadev.meditation.data

import app.mannadev.meditation.dto.QtDto
import app.mannadev.meditation.widget.WidgetUpdateNotifier
import app.mannadev.meditation.widget.state.WidgetContentState
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class QtRepositoryImplTest {

    private class FakeQtPrefsSource : QtPrefsSource {
        var stored: QtDto? = null
        override suspend fun getDisplayQt(): QtDto? = stored
        override suspend fun saveDisplayQt(qt: QtDto) { stored = qt }
        override suspend fun clearDisplayQt() { stored = null }
    }

    private class FakeQtRemoteSource(private var result: QtDto?) : QtRemoteSource {
        var throwOnFetch: Throwable? = null
        override suspend fun fetchLatestQt(): QtDto? {
            throwOnFetch?.let { throw it }
            return result
        }
    }

    private class FakeAppLaunchState(private val launched: Boolean) : AppLaunchState {
        override fun hasEverLaunched(): Boolean = launched
    }

    private class FakeWidgetUpdateNotifier : WidgetUpdateNotifier {
        var sermonNotifyCount = 0
        var qtNotifyCount = 0
        override suspend fun notifySermonChanged() { sermonNotifyCount++ }
        override suspend fun notifyQtChanged() { qtNotifyCount++ }
    }

    private val sampleDto = QtDto(
        date = "2026-07-09",
        title = "테스트 QT",
        seriesTitle = "",
        content = "본문 : 요한복음 1:1 1 태초에",
        dayOfWeek = "THU",
        videoUrl = null,
        meditationQuestions = listOf("질문1"),
    )

    @Test
    fun `save persists to prefs, updates state to Data, and notifies QT only`() = runTest {
        val prefs = FakeQtPrefsSource()
        val notifier = FakeWidgetUpdateNotifier()
        val repository = QtRepositoryImpl(
            prefsSource = prefs,
            remoteSource = FakeQtRemoteSource(null),
            widgetUpdateNotifier = notifier,
            appLaunchState = FakeAppLaunchState(true),
        )

        repository.save(sampleDto)

        assertEquals(sampleDto, prefs.stored)
        val state = repository.qtState.value
        assertTrue(state is WidgetContentState.Data)
        assertEquals(sampleDto, (state as WidgetContentState.Data).value)
        assertEquals(1, notifier.qtNotifyCount)
        assertEquals(0, notifier.sermonNotifyCount)
    }

    @Test
    fun `syncFromRemote saves fetched qt when remote has data`() = runTest {
        val prefs = FakeQtPrefsSource()
        val repository = QtRepositoryImpl(
            prefsSource = prefs,
            remoteSource = FakeQtRemoteSource(sampleDto),
            widgetUpdateNotifier = FakeWidgetUpdateNotifier(),
            appLaunchState = FakeAppLaunchState(false),
        )

        repository.syncFromRemote()

        assertEquals(sampleDto, prefs.stored)
    }

    @Test(expected = RuntimeException::class)
    fun `syncFromRemote propagates remote failure`() = runTest {
        val remote = FakeQtRemoteSource(null).apply {
            throwOnFetch = RuntimeException("network down")
        }
        val repository = QtRepositoryImpl(
            prefsSource = FakeQtPrefsSource(),
            remoteSource = remote,
            widgetUpdateNotifier = FakeWidgetUpdateNotifier(),
            appLaunchState = FakeAppLaunchState(false),
        )

        repository.syncFromRemote()
    }

    @Test
    fun `clear resets state to NoDataYet`() = runTest {
        val prefs = FakeQtPrefsSource().apply { stored = sampleDto }
        val repository = QtRepositoryImpl(
            prefsSource = prefs,
            remoteSource = FakeQtRemoteSource(null),
            widgetUpdateNotifier = FakeWidgetUpdateNotifier(),
            appLaunchState = FakeAppLaunchState(false),
        )

        repository.clear()

        assertEquals(null, prefs.stored)
        assertTrue(repository.qtState.value is WidgetContentState.NoDataYet)
    }
}
