package example

import example.telldontask.after.AdminCancelTool as AfterAdminCancelTool
import example.telldontask.after.ApiCancelHandler as AfterApiCancelHandler
import example.telldontask.after.Clock as AfterClock
import example.telldontask.after.NightlyCancelJob as AfterNightlyCancelJob
import example.telldontask.after.Order as AfterOrder
import example.telldontask.after.OrderStatus as AfterOrderStatus
import example.telldontask.before.AdminCancelTool as BeforeAdminCancelTool
import example.telldontask.before.ApiCancelHandler as BeforeApiCancelHandler
import example.telldontask.before.Clock as BeforeClock
import example.telldontask.before.NightlyCancelJob as BeforeNightlyCancelJob
import example.telldontask.before.Order as BeforeOrder
import example.telldontask.before.OrderStatus as BeforeOrderStatus
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull

class TellDontAskTest {
    private class FixedClock(private val ms: Long) : BeforeClock, AfterClock {
        override fun nowMs(): Long = ms
    }

    @Test
    fun `before - api handler cancels a pending order and sets the refund`() {
        val order = BeforeOrder(id = 1, status = BeforeOrderStatus.PENDING, amountPaidCents = 5000)
        BeforeApiCancelHandler().cancel(order, FixedClock(1000))
        assertEquals(BeforeOrderStatus.CANCELLED, order.status)
        assertEquals(1000, order.cancelledAtMs)
        assertEquals(5000, order.refundDueCents)
    }

    @Test
    fun `before - nightly job cancels a stale order but leaves the refund unset`() {
        val order = BeforeOrder(id = 2, status = BeforeOrderStatus.PENDING, amountPaidCents = 5000)
        BeforeNightlyCancelJob().cancel(order, FixedClock(1000))
        assertEquals(BeforeOrderStatus.CANCELLED, order.status)
        assertEquals(0, order.refundDueCents) // bug: the payment is gone, no refund recorded
    }

    @Test
    fun `before - admin tool cancels an already shipped order`() {
        val order = BeforeOrder(
            id = 3,
            status = BeforeOrderStatus.SHIPPED,
            amountPaidCents = 5000,
            shippedAtMs = 500,
        )
        BeforeAdminCancelTool().cancel(order, FixedClock(1000))
        assertEquals(BeforeOrderStatus.CANCELLED, order.status) // bug: should stay shipped
    }

    @Test
    fun `after - api handler nightly job and admin tool all cancel the same way`() {
        val clock = FixedClock(1000)

        val apiOrder = AfterOrder(1, AfterOrderStatus.PENDING, 5000)
        AfterApiCancelHandler().cancel(apiOrder, clock)

        val nightlyOrder = AfterOrder(2, AfterOrderStatus.PENDING, 5000)
        AfterNightlyCancelJob().cancel(nightlyOrder, clock)

        val adminOrder = AfterOrder(3, AfterOrderStatus.PENDING, 5000)
        AfterAdminCancelTool().cancel(adminOrder, clock)

        for (order in listOf(apiOrder, nightlyOrder, adminOrder)) {
            assertEquals(AfterOrderStatus.CANCELLED, order.status)
            assertEquals(1000, order.cancelledAtMs)
            assertEquals(5000, order.refundDueCents)
        }
    }

    @Test
    fun `after - cancelling an already shipped order is rejected`() {
        val clock = FixedClock(1000)

        val apiOrder = AfterOrder(4, AfterOrderStatus.SHIPPED, 5000, 500)
        assertFailsWith<IllegalStateException> { AfterApiCancelHandler().cancel(apiOrder, clock) }

        val nightlyOrder = AfterOrder(5, AfterOrderStatus.SHIPPED, 5000, 500)
        assertFailsWith<IllegalStateException> { AfterNightlyCancelJob().cancel(nightlyOrder, clock) }

        val adminOrder = AfterOrder(6, AfterOrderStatus.SHIPPED, 5000, 500)
        assertFailsWith<IllegalStateException> { AfterAdminCancelTool().cancel(adminOrder, clock) }

        for (order in listOf(apiOrder, nightlyOrder, adminOrder)) {
            assertEquals(AfterOrderStatus.SHIPPED, order.status)
            assertNull(order.cancelledAtMs)
            assertEquals(0, order.refundDueCents)
        }
    }
}
