package app.mannadev.meditation.data

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class FontScaleStateTest {

    @Test fun `최초 실행(기록 없음)은 변경으로 취급하지 않음`() {
        assertFalse(hasFontScaleChanged(current = 1.3f, lastKnown = null))
    }

    @Test fun `기록된 값과 동일하면 변경 아님`() {
        assertFalse(hasFontScaleChanged(current = 1.0f, lastKnown = 1.0f))
    }

    @Test fun `기록된 값과 다르면 변경`() {
        assertTrue(hasFontScaleChanged(current = 2.0f, lastKnown = 1.0f))
    }
}
