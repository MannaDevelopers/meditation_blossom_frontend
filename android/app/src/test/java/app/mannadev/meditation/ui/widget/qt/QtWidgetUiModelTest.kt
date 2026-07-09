package app.mannadev.meditation.ui.widget.qt

import app.mannadev.meditation.Constants
import org.junit.Assert.assertEquals
import org.junit.Test

class QtWidgetUiModelTest {

    @Test fun `noData는 최초 실행 안내를 반환`() {
        val result = QtWidgetUiModel.noData
        assertEquals("QT 위젯 설치 완료!", result.title)
        assertEquals(listOf(Constants.WIDGET_FIRST_LAUNCH_GUIDE_MESSAGE), result.verses)
    }

    @Test fun `error는 새로고침 유도 안내를 반환`() {
        val result = QtWidgetUiModel.error
        assertEquals("QT를 불러오지 못했습니다", result.title)
        assertEquals(listOf(Constants.WIDGET_ERROR_GUIDE_MESSAGE), result.verses)
    }
}
