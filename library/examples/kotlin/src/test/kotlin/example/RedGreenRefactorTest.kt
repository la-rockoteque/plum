package example

import example.redgreenrefactor.green.Order as GreenOrder
import example.redgreenrefactor.red.Order as RedOrder
import example.redgreenrefactor.refactor.Order as RefactorOrder
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class RedGreenRefactorTest {
    @Test
    fun `red - cancelling a shipped order is still allowed`() {
        // The new rule doesn't exist yet: this passing test pins the flaw it will fix.
        val order = RedOrder("shipped")
        order.cancel()
        assertEquals("cancelled", order.status)
    }

    // One shared test body runs against both stages, built as closures since green.Order and refactor.Order
    // share no common type: green and refactor must behave identically.
    private data class Stage(val name: String, val build: (String) -> Pair<() -> Unit, () -> String>)

    private val stages = listOf(
        Stage("green") { status ->
            val order = GreenOrder(status)
            Pair({ order.cancel() }, { order.status })
        },
        Stage("refactor") { status ->
            val order = RefactorOrder(status)
            Pair({ order.cancel() }, { order.status })
        },
    )

    // Shared bodies, one @Test per stage, so every language reports the same five tests.
    private fun cancellingAPendingOrderSucceeds(stage: Stage) {
        val (cancel, status) = stage.build("pending")
        cancel()
        assertEquals("cancelled", status(), stage.name)
    }

    private fun cancellingAShippedOrderIsRejected(stage: Stage) {
        val (cancel, status) = stage.build("shipped")
        assertFailsWith<IllegalStateException>(message = stage.name) { cancel() }
        assertEquals("shipped", status(), stage.name)
    }

    @Test fun `cancelling a pending order succeeds - green`() = cancellingAPendingOrderSucceeds(stages[0])
    @Test fun `cancelling a pending order succeeds - refactor`() = cancellingAPendingOrderSucceeds(stages[1])
    @Test fun `cancelling a shipped order is rejected - green`() = cancellingAShippedOrderIsRejected(stages[0])
    @Test fun `cancelling a shipped order is rejected - refactor`() = cancellingAShippedOrderIsRejected(stages[1])
}
