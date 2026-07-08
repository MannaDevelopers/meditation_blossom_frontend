package app.mannadev.meditation.model

import app.mannadev.meditation.Constants
import org.junit.Assert.assertEquals
import org.junit.Test

class SermonTest {

    @Test fun `앱을 실행한 적 있으면 기존 에러 안내를 반환`() {
        val result = Sermon.noData(hasAppEverLaunched = true)
        assertEquals(Sermon.errorSermon, result)
    }

    @Test fun `앱을 실행한 적 없으면 최초 실행 안내를 반환`() {
        val result = Sermon.noData(hasAppEverLaunched = false)
        assertEquals(Constants.WIDGET_FIRST_LAUNCH_TITLE, result.title)
        assertEquals(listOf(Constants.WIDGET_FIRST_LAUNCH_GUIDE_MESSAGE), result.verses)
    }
}
