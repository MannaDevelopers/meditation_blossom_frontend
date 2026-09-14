package app.mannadev.meditation.ui.widget.theme

import androidx.compose.ui.unit.sp
import org.junit.Assert.assertEquals
import org.junit.Test

class TypeTest {

    @Test fun `fontScale이 1이면 원래 값 그대로`() {
        assertEquals(16f.sp, fixedSp(16f, 1f))
    }

    @Test fun `fontScale이 1보다 크면 나눠서 상쇄`() {
        assertEquals((16f / 1.3f).sp, fixedSp(16f, 1.3f))
    }

    @Test fun `fontScale이 최대치(2)여도 나눠서 상쇄`() {
        assertEquals((16f / 2f).sp, fixedSp(16f, 2f))
    }
}
