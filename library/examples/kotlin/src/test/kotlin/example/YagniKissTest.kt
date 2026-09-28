package example

import example.yagnikiss.after.Clock as AfterClock
import example.yagnikiss.after.Order as AfterOrder
import example.yagnikiss.after.OrderStatus as AfterStatus
import example.yagnikiss.before.Clock as BeforeClock
import example.yagnikiss.before.Order as BeforeOrder
import example.yagnikiss.before.OrderCancellationService
import example.yagnikiss.before.OrderStatus as BeforeStatus
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class YagniKissTest {
    private val nowMs = 10_000_000L
    private val windowMs = 24L * 60 * 60 * 1000

    private class FixedClock(private val ms: Long) : BeforeClock, AfterClock {
        override fun nowMs(): Long = ms
    }

    @Test
    fun `before - a fresh pending order can be cancelled`() {
        val order = BeforeOrder(1, BeforeStatus.PENDING, nowMs)
        val clock = FixedClock(nowMs)
        assertTrue(OrderCancellationService().canCancel(order, clock))
    }

    @Test
    fun `before - an order past the cancellation window cannot be cancelled`() {
        val order = BeforeOrder(1, BeforeStatus.PENDING, nowMs - windowMs * 2)
        val clock = FixedClock(nowMs)
        assertFalse(OrderCancellationService().canCancel(order, clock))
    }

    @Test
    fun `before - a shipped order cannot be cancelled`() {
        val order = BeforeOrder(1, BeforeStatus.SHIPPED, nowMs)
        val clock = FixedClock(nowMs)
        assertFalse(OrderCancellationService().canCancel(order, clock))
    }

    @Test
    fun `before - a typo in the policy config name silently falls back to the default policy`() {
        val order = BeforeOrder(1, BeforeStatus.PENDING, nowMs)
        val clock = FixedClock(nowMs)
        val correctlyNamed = OrderCancellationService(policyName = "standard")
        val typoNamed = OrderCancellationService(policyName = "stadnard")
        assertEquals(correctlyNamed.canCancel(order, clock), typoNamed.canCancel(order, clock))
    }

    @Test
    fun `before - the unused cancellation hooks are empty by default`() {
        val service = OrderCancellationService()
        assertTrue(service.hooks.onBeforeCancel.isEmpty())
        assertTrue(service.hooks.onAfterCancel.isEmpty())
    }

    @Test
    fun `after - a fresh pending order can be cancelled`() {
        val order = AfterOrder(1, AfterStatus.PENDING, nowMs)
        val clock = FixedClock(nowMs)
        assertTrue(order.canBeCancelled(clock))
    }

    @Test
    fun `after - an order past the cancellation window cannot be cancelled`() {
        val order = AfterOrder(1, AfterStatus.PENDING, nowMs - windowMs * 2)
        val clock = FixedClock(nowMs)
        assertFalse(order.canBeCancelled(clock))
    }

    @Test
    fun `after - a shipped order cannot be cancelled`() {
        val order = AfterOrder(1, AfterStatus.SHIPPED, nowMs)
        val clock = FixedClock(nowMs)
        assertFalse(order.canBeCancelled(clock))
    }
}
