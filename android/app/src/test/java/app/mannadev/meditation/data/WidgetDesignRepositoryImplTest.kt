package app.mannadev.meditation.data

import app.mannadev.meditation.dto.WidgetBackgroundDesignDto
import app.mannadev.meditation.dto.WidgetDesignDto
import app.mannadev.meditation.dto.WidgetImageTransformDto
import app.mannadev.meditation.dto.WidgetTextDesignDto
import app.mannadev.meditation.widget.WidgetUpdateNotifier
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class WidgetDesignRepositoryImplTest {

    private class FakeWidgetDesignPrefsSource : WidgetDesignPrefsSource {
        var stored: WidgetDesignDto? = null
        var throwOnRead: Throwable? = null
        override suspend fun getDesign(): WidgetDesignDto? {
            throwOnRead?.let { throw it }
            return stored
        }
        override suspend fun saveDesign(design: WidgetDesignDto) { stored = design }
        override suspend fun clearDesign() { stored = null }
    }

    private class FakeWidgetUpdateNotifier : WidgetUpdateNotifier {
        var sermonNotifyCount = 0
        var qtNotifyCount = 0
        var designNotifyCount = 0
        override suspend fun notifySermonChanged() { sermonNotifyCount++ }
        override suspend fun notifyQtChanged() { qtNotifyCount++ }
        override suspend fun notifyDesignChanged() { designNotifyCount++ }
    }

    private val sampleDto = WidgetDesignDto(
        text = WidgetTextDesignDto(align = "left", color = "#000000", size = 16, weight = "regular"),
        background = WidgetBackgroundDesignDto(type = "color", value = "gradient-default"),
    )

    private val sampleGalleryDto = WidgetDesignDto(
        text = WidgetTextDesignDto(align = "center", color = "#FFFFFF", size = 24, weight = "bold"),
        background = WidgetBackgroundDesignDto(
            type = "gallery",
            value = "/data/user/0/app.mannadev.meditation.debug/files/widget_design_background.jpg",
            imageTransform = WidgetImageTransformDto(zoom = 1.5, focalX = 0.4, focalY = 0.6),
        ),
    )

    @Test
    fun `save persists to prefs, updates state, and notifies once`() = runTest {
        val prefs = FakeWidgetDesignPrefsSource()
        val notifier = FakeWidgetUpdateNotifier()
        val repository = WidgetDesignRepositoryImpl(prefsSource = prefs, widgetUpdateNotifier = notifier)

        repository.save(sampleDto)

        assertEquals(sampleDto, prefs.stored)
        assertEquals(sampleDto, repository.designState.value)
        assertEquals(1, notifier.designNotifyCount)
        assertEquals(0, notifier.sermonNotifyCount)
        assertEquals(0, notifier.qtNotifyCount)
    }

    @Test
    fun `save preserves gallery background fields including imageTransform`() = runTest {
        val prefs = FakeWidgetDesignPrefsSource()
        val repository = WidgetDesignRepositoryImpl(prefsSource = prefs, widgetUpdateNotifier = FakeWidgetUpdateNotifier())

        repository.save(sampleGalleryDto)

        val saved = repository.designState.value
        assertEquals("gallery", saved?.background?.type)
        assertEquals(1.5, saved?.background?.imageTransform?.zoom)
        assertEquals(0.4, saved?.background?.imageTransform?.focalX)
        assertEquals(0.6, saved?.background?.imageTransform?.focalY)
    }

    @Test
    fun `clear resets state to null and notifies`() = runTest {
        val prefs = FakeWidgetDesignPrefsSource().apply { stored = sampleDto }
        val notifier = FakeWidgetUpdateNotifier()
        val repository = WidgetDesignRepositoryImpl(prefsSource = prefs, widgetUpdateNotifier = notifier)

        repository.clear()

        assertNull(prefs.stored)
        assertNull(repository.designState.value)
        assertEquals(1, notifier.designNotifyCount)
    }

    // 생성자 init { scope.launch { ... } }의 최초 로드는 Dispatchers.IO에서 비동기로 실행되어
    // runTest의 TestDispatcher와 타이밍이 분리되므로(SermonRepositoryImplTest도 동일한 이유로
    // 초기 로드 자체는 테스트하지 않는다), 여기서는 save/clear를 통한 결정적 경로만 검증한다.
}
