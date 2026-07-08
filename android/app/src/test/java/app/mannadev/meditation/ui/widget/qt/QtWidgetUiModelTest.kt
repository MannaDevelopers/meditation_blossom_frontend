package app.mannadev.meditation.ui.widget.qt

import app.mannadev.meditation.Constants
import org.junit.Assert.assertEquals
import org.junit.Test

class QtWidgetUiModelTest {

    @Test fun `앱을 실행한 적 있으면 기존 에러 안내를 반환`() {
        val result = QtWidgetUiModel.error(hasAppEverLaunched = true)
        assertEquals("QT를 불러오지 못했습니다", result.title)
        assertEquals(listOf(Constants.WIDGET_ERROR_GUIDE_MESSAGE), result.verses)
    }

    @Test fun `앱을 실행한 적 없으면 최초 실행 안내를 반환`() {
        val result = QtWidgetUiModel.error(hasAppEverLaunched = false)
        assertEquals(Constants.WIDGET_FIRST_LAUNCH_TITLE, result.title)
        assertEquals(listOf(Constants.WIDGET_FIRST_LAUNCH_GUIDE_MESSAGE), result.verses)
    }
}
