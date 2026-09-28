package example

import example.dry.after.ApiCancelHandler as AfterApi
import example.dry.after.CliCancelHandler as AfterCli
import example.dry.after.Clock as AfterClock
import example.dry.after.Order as AfterOrder
import example.dry.after.OrderStatus as AfterStatus
import example.dry.before.ApiCancelHandler as BeforeApi
import example.dry.before.CliCancelHandler as BeforeCli
import example.dry.before.Clock as BeforeClock
import example.dry.before.Order as BeforeOrder
import example.dry.before.OrderStatus as BeforeStatus
import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class DryTest {
    private val nowMs = 10_000_000L
    private val windowMs = 24L * 60 * 60 * 1000

    private class FixedClock(private val ms: Long) : BeforeClock, AfterClock {
        override fun nowMs(): Long = ms
    }

    @Test
    fun `before - cli and api agree a fresh pending order can be cancelled`() {
        val order = BeforeOrder(1, BeforeStatus.PENDING, nowMs)
        val clock = FixedClock(nowMs)
        assertTrue(BeforeCli().canCancel(order, clock))
        assertTrue(BeforeApi().canCancel(order, clock))
    }

    @Test
    fun `before - cli and api disagree once the cancellation window has passed`() {
        val order = BeforeOrder(1, BeforeStatus.PENDING, nowMs - windowMs * 2)
        val clock = FixedClock(nowMs)
        assertFalse(BeforeCli().canCancel(order, clock))
        assertTrue(BeforeApi().canCancel(order, clock))
    }

    @Test
    fun `before - neither handler allows cancelling a shipped order`() {
        val order = BeforeOrder(1, BeforeStatus.SHIPPED, nowMs)
        val clock = FixedClock(nowMs)
        assertFalse(BeforeCli().canCancel(order, clock))
        assertFalse(BeforeApi().canCancel(order, clock))
    }

    @Test
    fun `after - cli and api agree a fresh pending order can be cancelled`() {
        val order = AfterOrder(1, AfterStatus.PENDING, nowMs)
        val clock = FixedClock(nowMs)
        assertTrue(AfterCli().canCancel(order, clock))
        assertTrue(AfterApi().canCancel(order, clock))
    }

    @Test
    fun `after - cli and api agree once the cancellation window has passed`() {
        val order = AfterOrder(1, AfterStatus.PENDING, nowMs - windowMs * 2)
        val clock = FixedClock(nowMs)
        assertFalse(AfterCli().canCancel(order, clock))
        assertFalse(AfterApi().canCancel(order, clock))
    }

    @Test
    fun `after - neither handler allows cancelling a shipped order`() {
        val order = AfterOrder(1, AfterStatus.SHIPPED, nowMs)
        val clock = FixedClock(nowMs)
        assertFalse(AfterCli().canCancel(order, clock))
        assertFalse(AfterApi().canCancel(order, clock))
    }
}
