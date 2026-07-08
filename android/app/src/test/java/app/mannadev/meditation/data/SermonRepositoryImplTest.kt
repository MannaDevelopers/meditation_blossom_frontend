package app.mannadev.meditation.data

import app.mannadev.meditation.dto.SermonDto
import app.mannadev.meditation.widget.WidgetUpdateNotifier
import app.mannadev.meditation.widget.state.WidgetContentState
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SermonRepositoryImplTest {

    private class FakeSermonPrefsSource : SermonPrefsSource {
        var stored: SermonDto? = null
        var throwOnRead: Throwable? = null
        override suspend fun getDisplaySermon(): SermonDto? {
            throwOnRead?.let { throw it }
            return stored
        }
        override suspend fun saveDisplaySermon(sermon: SermonDto) { stored = sermon }
        override suspend fun clearDisplaySermon() { stored = null }
    }

    private class FakeSermonRemoteSource(private var result: SermonDto?) : SermonRemoteSource {
        var throwOnFetch: Throwable? = null
        override suspend fun fetchLatestSermon(): SermonDto? {
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

    private val sampleDto = SermonDto(
        date = "2026-07-06",
        title = "테스트 설교",
        content = "본문 : 로마서 1:1 1 바울은",
        dayOfWeek = "SUN",
        videoUrl = null,
    )

    @Test
    fun `save persists to prefs, updates state to Data, and notifies once`() = runTest {
        val prefs = FakeSermonPrefsSource()
        val notifier = FakeWidgetUpdateNotifier()
        val repository = SermonRepositoryImpl(
            prefsSource = prefs,
            remoteSource = FakeSermonRemoteSource(null),
            widgetUpdateNotifier = notifier,
        )

        repository.save(sampleDto)

        assertEquals(sampleDto, prefs.stored)
        val state = repository.sermonState.value
        assertTrue(state is WidgetContentState.Data)
        assertEquals("테스트 설교", (state as WidgetContentState.Data).value.title)
        assertEquals(1, notifier.sermonNotifyCount)
        assertEquals(0, notifier.qtNotifyCount)
    }

    @Test
    fun `syncFromRemote saves fetched sermon when remote has data`() = runTest {
        val prefs = FakeSermonPrefsSource()
        val notifier = FakeWidgetUpdateNotifier()
        val repository = SermonRepositoryImpl(
            prefsSource = prefs,
            remoteSource = FakeSermonRemoteSource(sampleDto),
            widgetUpdateNotifier = notifier,
        )

        repository.syncFromRemote()

        assertEquals(sampleDto, prefs.stored)
        assertTrue(repository.sermonState.value is WidgetContentState.Data)
        assertEquals(1, notifier.sermonNotifyCount)
    }

    @Test
    fun `syncFromRemote sets NoDataYet and notifies when remote genuinely has no documents`() = runTest {
        val prefs = FakeSermonPrefsSource()
        val notifier = FakeWidgetUpdateNotifier()
        val repository = SermonRepositoryImpl(
            prefsSource = prefs,
            remoteSource = FakeSermonRemoteSource(null),
            widgetUpdateNotifier = notifier,
        )

        repository.syncFromRemote()

        assertEquals(null, prefs.stored)
        assertTrue(repository.sermonState.value is WidgetContentState.NoDataYet)
        assertEquals(1, notifier.sermonNotifyCount)
    }

    @Test
    fun `syncFromRemote sets Error and notifies, then rethrows, when remote fetch fails`() = runTest {
        val notifier = FakeWidgetUpdateNotifier()
        val remote = FakeSermonRemoteSource(null).apply {
            throwOnFetch = RuntimeException("network down")
        }
        val repository = SermonRepositoryImpl(
            prefsSource = FakeSermonPrefsSource(),
            remoteSource = remote,
            widgetUpdateNotifier = notifier,
        )

        val thrown = runCatching { repository.syncFromRemote() }.exceptionOrNull()

        assertEquals("network down", thrown?.message)
        assertTrue(repository.sermonState.value is WidgetContentState.Error)
        assertEquals(1, notifier.sermonNotifyCount)
    }

    @Test
    fun `syncFromRemote keeps existing Data and does not notify, but still rethrows, when fetch fails after data was already present`() = runTest {
        val prefs = FakeSermonPrefsSource()
        val notifier = FakeWidgetUpdateNotifier()
        val remote = FakeSermonRemoteSource(null)
        val repository = SermonRepositoryImpl(
            prefsSource = prefs,
            remoteSource = remote,
            widgetUpdateNotifier = notifier,
        )

        repository.save(sampleDto)
        val notifyCountAfterSave = notifier.sermonNotifyCount

        remote.throwOnFetch = RuntimeException("network down")
        val thrown = runCatching { repository.syncFromRemote() }.exceptionOrNull()

        assertEquals("network down", thrown?.message)
        val state = repository.sermonState.value
        assertTrue(state is WidgetContentState.Data)
        assertEquals(sampleDto, prefs.stored)
        assertEquals("테스트 설교", (state as WidgetContentState.Data).value.title)
        assertEquals(notifyCountAfterSave, notifier.sermonNotifyCount)
    }

    @Test
    fun `clear resets state to NoDataYet and notifies`() = runTest {
        val prefs = FakeSermonPrefsSource().apply { stored = sampleDto }
        val notifier = FakeWidgetUpdateNotifier()
        val repository = SermonRepositoryImpl(
            prefsSource = prefs,
            remoteSource = FakeSermonRemoteSource(null),
            widgetUpdateNotifier = notifier,
        )

        repository.clear()

        assertEquals(null, prefs.stored)
        assertTrue(repository.sermonState.value is WidgetContentState.NoDataYet)
        assertEquals(1, notifier.sermonNotifyCount)
    }
}
