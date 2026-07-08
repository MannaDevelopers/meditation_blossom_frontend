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
        val notifier = FakeWidgetUpdateNotifier()
        val repository = QtRepositoryImpl(
            prefsSource = prefs,
            remoteSource = FakeQtRemoteSource(sampleDto),
            widgetUpdateNotifier = notifier,
        )

        repository.syncFromRemote()

        assertEquals(sampleDto, prefs.stored)
        assertEquals(1, notifier.qtNotifyCount)
    }

    @Test
    fun `syncFromRemote sets NoDataYet and notifies when remote genuinely has no documents`() = runTest {
        val prefs = FakeQtPrefsSource()
        val notifier = FakeWidgetUpdateNotifier()
        val repository = QtRepositoryImpl(
            prefsSource = prefs,
            remoteSource = FakeQtRemoteSource(null),
            widgetUpdateNotifier = notifier,
        )

        repository.syncFromRemote()

        assertEquals(null, prefs.stored)
        assertTrue(repository.qtState.value is WidgetContentState.NoDataYet)
        assertEquals(1, notifier.qtNotifyCount)
    }

    @Test
    fun `syncFromRemote sets Error and notifies, then rethrows, when remote fetch fails`() = runTest {
        val notifier = FakeWidgetUpdateNotifier()
        val remote = FakeQtRemoteSource(null).apply {
            throwOnFetch = RuntimeException("network down")
        }
        val repository = QtRepositoryImpl(
            prefsSource = FakeQtPrefsSource(),
            remoteSource = remote,
            widgetUpdateNotifier = notifier,
        )

        val thrown = runCatching { repository.syncFromRemote() }.exceptionOrNull()

        assertEquals("network down", thrown?.message)
        assertTrue(repository.qtState.value is WidgetContentState.Error)
        assertEquals(1, notifier.qtNotifyCount)
    }

    @Test
    fun `syncFromRemote keeps existing Data and does not notify, but still rethrows, when fetch fails after data was already present`() = runTest {
        val prefs = FakeQtPrefsSource()
        val notifier = FakeWidgetUpdateNotifier()
        val remote = FakeQtRemoteSource(null)
        val repository = QtRepositoryImpl(
            prefsSource = prefs,
            remoteSource = remote,
            widgetUpdateNotifier = notifier,
        )

        repository.save(sampleDto)
        val notifyCountAfterSave = notifier.qtNotifyCount

        remote.throwOnFetch = RuntimeException("network down")
        val thrown = runCatching { repository.syncFromRemote() }.exceptionOrNull()

        assertEquals("network down", thrown?.message)
        val state = repository.qtState.value
        assertTrue(state is WidgetContentState.Data)
        assertEquals(sampleDto, prefs.stored)
        assertEquals(sampleDto, (state as WidgetContentState.Data).value)
        assertEquals(notifyCountAfterSave, notifier.qtNotifyCount)
    }

    @Test
    fun `clear resets state to NoDataYet and notifies`() = runTest {
        val prefs = FakeQtPrefsSource().apply { stored = sampleDto }
        val notifier = FakeWidgetUpdateNotifier()
        val repository = QtRepositoryImpl(
            prefsSource = prefs,
            remoteSource = FakeQtRemoteSource(null),
            widgetUpdateNotifier = notifier,
        )

        repository.clear()

        assertEquals(null, prefs.stored)
        assertTrue(repository.qtState.value is WidgetContentState.NoDataYet)
        assertEquals(1, notifier.qtNotifyCount)
    }
}
