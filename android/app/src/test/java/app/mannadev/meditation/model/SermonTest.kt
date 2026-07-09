package app.mannadev.meditation.model

import app.mannadev.meditation.Constants
import org.junit.Assert.assertEquals
import org.junit.Test

class SermonTest {

    @Test fun `noData는 최초 실행 안내를 반환`() {
        val result = Sermon.noData
        assertEquals(Constants.WIDGET_FIRST_LAUNCH_TITLE, result.title)
        assertEquals(listOf(Constants.WIDGET_FIRST_LAUNCH_GUIDE_MESSAGE), result.verses)
    }

    @Test fun `errorSermon은 새로고침 유도 안내를 반환`() {
        val result = Sermon.errorSermon
        assertEquals("말씀을 불러오지 못했습니다", result.title)
        assertEquals(listOf(Constants.WIDGET_ERROR_GUIDE_MESSAGE), result.verses)
    }
}
