package app.mannadev.meditation.widget

import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertTrue
import org.junit.Test

class WidgetInitialSyncWorkerTest {

    @Test
    fun `runSync returns success when both syncs succeed`() = runTest {
        val result = runWidgetSync(
            syncSermon = { },
            syncQt = { },
        )
        assertTrue(result.isSuccess)
    }

    @Test
    fun `runSync returns failure when sermon sync throws`() = runTest {
        val result = runWidgetSync(
            syncSermon = { throw RuntimeException("network down") },
            syncQt = { },
        )
        assertTrue(result.isFailure)
    }

    @Test
    fun `runSync returns failure when qt sync throws`() = runTest {
        val result = runWidgetSync(
            syncSermon = { },
            syncQt = { throw RuntimeException("network down") },
        )
        assertTrue(result.isFailure)
    }

    @Test
    fun `runSync still invokes qt sync when sermon sync throws`() = runTest {
        var qtWasCalled = false
        val result = runWidgetSync(
            syncSermon = { throw RuntimeException("network down") },
            syncQt = { qtWasCalled = true },
        )
        assertTrue(qtWasCalled)
        assertTrue(result.isFailure)
    }

    @Test
    fun `runSync still invokes sermon sync when qt sync throws`() = runTest {
        var sermonWasCalled = false
        val result = runWidgetSync(
            syncSermon = { sermonWasCalled = true },
            syncQt = { throw RuntimeException("network down") },
        )
        assertTrue(sermonWasCalled)
        assertTrue(result.isFailure)
    }
}
