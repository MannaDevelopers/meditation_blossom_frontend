package app.mannadev.meditation.data

import app.mannadev.meditation.dto.WidgetBackgroundDesignDto
import app.mannadev.meditation.dto.WidgetDesignDto
import app.mannadev.meditation.dto.WidgetImageTransformDto
import app.mannadev.meditation.dto.WidgetTextDesignDto
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class WidgetDesignRepositoryImplTest {

    private class FakeWidgetDesignPrefsSource : WidgetDesignPrefsSource {
        var stored: WidgetDesignDto? = null
        var throwOnRead: Throwable? = null
        // 실제 구현(WidgetDesignPrefsDataSource)은 갤러리 배경일 때 saveDesign()이 받은 값을 그대로
        // 저장하지 않고 영구 경로로 치환해 반환한다 — 그 차이를 흉내내기 위한 훅.
        var persistedOverride: WidgetDesignDto? = null
        override suspend fun getDesign(): WidgetDesignDto? {
            throwOnRead?.let { throw it }
            return stored
        }
        override suspend fun saveDesign(design: WidgetDesignDto): WidgetDesignDto {
            val persisted = persistedOverride ?: design
            stored = persisted
            return persisted
        }
        override suspend fun clearDesign() { stored = null }
    }

    // 실제로는 di/AppModule.kt의 @Provides가 WidgetUpdateNotifier의
    // notifySermonDesignChanged/notifyQtDesignChanged 중 하나를 골라 넘기는 람다 — 테스트에서는
    // 호출 횟수만 세는 카운터로 충분하다.
    private class FakeDesignChangedCounter {
        var count = 0
        val callback: suspend () -> Unit = { count++ }
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
        val counter = FakeDesignChangedCounter()
        val repository = WidgetDesignRepositoryImpl(prefsSource = prefs, onDesignChanged = counter.callback)

        repository.save(sampleDto)

        assertEquals(sampleDto, prefs.stored)
        assertEquals(sampleDto, repository.designState.value)
        assertEquals(1, counter.count)
    }

    @Test
    fun `save preserves gallery background fields including imageTransform`() = runTest {
        val prefs = FakeWidgetDesignPrefsSource()
        val repository = WidgetDesignRepositoryImpl(prefsSource = prefs, onDesignChanged = FakeDesignChangedCounter().callback)

        repository.save(sampleGalleryDto)

        val saved = repository.designState.value
        assertEquals("gallery", saved?.background?.type)
        assertEquals(1.5, saved?.background?.imageTransform?.zoom)
        assertEquals(0.4, saved?.background?.imageTransform?.focalX)
        assertEquals(0.6, saved?.background?.imageTransform?.focalY)
    }

    @Test
    fun `save reflects prefsSource's persisted return value in state, not the raw input`() = runTest {
        // 회귀 테스트: 위젯이 react-native-image-picker의 임시 캐시 경로(피커가 정리하면 사라지거나,
        // file:// 스킴이라 BitmapFactory가 애초에 못 여는 경로)를 참조해 갤러리 배경이 미리보기에만
        // 보이고 실제 위젯엔 반영되지 않던 버그 — save()가 saveDesign()의 반환값이 아니라 전달받은
        // dto를 그대로 상태에 반영해서 생겼다.
        val persistedWithLocalPath = sampleGalleryDto.copy(
            background = sampleGalleryDto.background.copy(
                value = "/data/user/0/app.mannadev.meditation.debug/files/widget_design_background.jpg",
            ),
        )
        val prefs = FakeWidgetDesignPrefsSource().apply { persistedOverride = persistedWithLocalPath }
        val repository = WidgetDesignRepositoryImpl(prefsSource = prefs, onDesignChanged = FakeDesignChangedCounter().callback)

        val rawInputWithPickerCachePath = sampleGalleryDto.copy(
            background = sampleGalleryDto.background.copy(
                value = "file:///data/user/0/app.mannadev.meditation.debug/cache/rn_image_picker_lib_temp_x.jpg",
            ),
        )
        repository.save(rawInputWithPickerCachePath)

        assertEquals(persistedWithLocalPath, repository.designState.value)
    }

    @Test
    fun `clear resets state to null and notifies`() = runTest {
        val prefs = FakeWidgetDesignPrefsSource().apply { stored = sampleDto }
        val counter = FakeDesignChangedCounter()
        val repository = WidgetDesignRepositoryImpl(prefsSource = prefs, onDesignChanged = counter.callback)

        repository.clear()

        assertNull(prefs.stored)
        assertNull(repository.designState.value)
        assertEquals(1, counter.count)
    }

    // 생성자 init { scope.launch { ... } }의 최초 로드는 Dispatchers.IO에서 비동기로 실행되어
    // runTest의 TestDispatcher와 타이밍이 분리되므로(SermonRepositoryImplTest도 동일한 이유로
    // 초기 로드 자체는 테스트하지 않는다), 여기서는 save/clear를 통한 결정적 경로만 검증한다.
}
