package example

import example.redgreenrefactor.green.Order as GreenOrder
import example.redgreenrefactor.red.Order as RedOrder
import example.redgreenrefactor.refactor.Order as RefactorOrder
import example.redgreenrefactor.refactor.OrderStatus
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class RedGreenRefactorTest {
    @Test
    fun `red - cancelling a shipped order is still allowed, the new requirement fails here`() {
        // The new rule doesn't exist yet: this passing test pins the flaw it will fix.
        val order = RedOrder("shipped")
        order.cancel()
        assertEquals("cancelled", order.status)
    }

    @Test
    fun `green - cancelling a pending order succeeds`() {
        val order = GreenOrder("pending")
        order.cancel()
        assertEquals("cancelled", order.status)
    }

    @Test
    fun `green - cancelling a shipped order is rejected`() {
        val order = GreenOrder("shipped")
        assertFailsWith<IllegalStateException> { order.cancel() }
        assertEquals("shipped", order.status)
    }

    @Test
    fun `refactor - cancelling a pending order succeeds`() {
        // Same case as green, run against the refactored design.
        val order = RefactorOrder(OrderStatus.PENDING)
        order.cancel()
        assertEquals(OrderStatus.CANCELLED, order.status)
    }

    @Test
    fun `refactor - cancelling a shipped order is rejected`() {
        // Same case as green, run against the refactored design.
        val order = RefactorOrder(OrderStatus.SHIPPED)
        assertFailsWith<IllegalStateException> { order.cancel() }
        assertEquals(OrderStatus.SHIPPED, order.status)
    }
}
