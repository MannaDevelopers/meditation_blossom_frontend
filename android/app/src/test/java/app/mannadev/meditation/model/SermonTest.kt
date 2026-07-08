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
}
