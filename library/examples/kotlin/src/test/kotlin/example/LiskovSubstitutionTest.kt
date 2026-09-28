package example

import example.liskovsubstitution.after.CancelExpiredOrders as AfterCancelExpiredOrders
import example.liskovsubstitution.after.CancellableOrder
import example.liskovsubstitution.after.CustomerServiceCancelTool as AfterCustomerServiceCancelTool
import example.liskovsubstitution.after.GiftOrder as AfterGiftOrder
import example.liskovsubstitution.after.OrderStatus as AfterOrderStatus
import example.liskovsubstitution.after.StandardOrder
import example.liskovsubstitution.after.SubscriptionOrder
import example.liskovsubstitution.before.CancelExpiredOrders as BeforeCancelExpiredOrders
import example.liskovsubstitution.before.CustomerServiceCancelTool as BeforeCustomerServiceCancelTool
import example.liskovsubstitution.before.GiftOrder as BeforeGiftOrder
import example.liskovsubstitution.before.Order as BeforeOrder
import example.liskovsubstitution.before.OrderStatus as BeforeOrderStatus
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class LiskovSubstitutionTest {
    @Test
    fun `before - a pending order can be cancelled`() {
        val order = BeforeOrder(id = 1)
        order.cancel("customer requested")
        assertEquals(BeforeOrderStatus.CANCELLED, order.status)
    }

    // The precondition GiftOrder accepts is stricter than Order's: Order
    // allows cancelling while pending, GiftOrder never does. That's the LSP
    // violation.
    @Test
    fun `before - a gift order rejects cancellation even while pending`() {
        val gift = BeforeGiftOrder(id = 1)
        val error = assertFailsWith<IllegalArgumentException> { gift.cancel("customer requested") }
        assertEquals("gift orders can't be cancelled online", error.message)
        assertEquals(BeforeOrderStatus.PENDING, gift.status)
    }

    @Test
    fun `before - the expired orders batch must skip gift orders to avoid the broken contract`() {
        val batch = BeforeCancelExpiredOrders()
        val standard = BeforeOrder(id = 1)
        val gift = BeforeGiftOrder(id = 2)
        val (cancelled, skipped) = batch.execute(listOf(standard, gift), "expired")
        assertEquals(listOf(1), cancelled)
        assertEquals(listOf(2), skipped)
        assertEquals(BeforeOrderStatus.CANCELLED, standard.status)
        assertEquals(BeforeOrderStatus.PENDING, gift.status)
    }

    @Test
    fun `before - the customer service tool must special case gift orders to avoid the broken contract`() {
        val tool = BeforeCustomerServiceCancelTool()
        val standard = BeforeOrder(id = 1)
        val gift = BeforeGiftOrder(id = 2)
        assertEquals("order 1 cancelled: changed my mind", tool.cancel(standard, "changed my mind"))
        assertEquals(BeforeOrderStatus.CANCELLED, standard.status)
        assertEquals(
            "order 2 must be cancelled by phone: gift orders can't be cancelled online",
            tool.cancel(gift, "changed my mind"),
        )
        assertEquals(BeforeOrderStatus.PENDING, gift.status)
    }

    // The same contract body runs against every CancellableOrder subtype.
    private val cancellableFactories: List<Pair<String, () -> CancellableOrder>> = listOf(
        "standard order" to { StandardOrder(id = 1) },
        "subscription order" to { SubscriptionOrder(id = 1) },
    )

    @Test
    fun `after - any cancellable order can be cancelled while pending`() {
        for ((name, factory) in cancellableFactories) {
            val order = factory()
            order.cancel("customer requested")
            assertEquals(AfterOrderStatus.CANCELLED, order.status, name)
        }
    }

    @Test
    fun `after - any cancellable order rejects cancelling an already cancelled order`() {
        for ((name, factory) in cancellableFactories) {
            val order = factory()
            order.cancel("customer requested")
            val error = assertFailsWith<IllegalArgumentException>(message = name) { order.cancel("customer requested") }
            assertEquals("cannot cancel a shipped or cancelled order", error.message, name)
        }
    }

    @Test
    fun `after - the expired orders batch cancels every cancellable order without checking its type`() {
        val batch = AfterCancelExpiredOrders()
        val standard = StandardOrder(id = 1)
        val subscription = SubscriptionOrder(id = 2)
        val cancelled = batch.execute(listOf(standard, subscription), "expired")
        assertEquals(listOf(1, 2), cancelled)
        assertEquals(AfterOrderStatus.CANCELLED, standard.status)
        assertEquals(AfterOrderStatus.CANCELLED, subscription.status)
    }

    @Test
    fun `after - the customer service tool cancels any cancellable order without checking its type`() {
        val tool = AfterCustomerServiceCancelTool()
        val standard = StandardOrder(id = 1)
        val subscription = SubscriptionOrder(id = 2)
        assertEquals("order 1 cancelled: changed my mind", tool.cancel(standard, "changed my mind"))
        assertEquals("order 2 cancelled: changed my mind", tool.cancel(subscription, "changed my mind"))
    }

    // A gift order shares Order's shape but was never given a cancel()
    // method, so it doesn't implement CancellableOrder — checkable directly
    // at runtime since Kotlin interfaces exist on the JVM.
    @Test
    fun `after - a gift order does not satisfy the cancellable order contract`() {
        val gift = AfterGiftOrder(id = 1)
        assertFalse(gift is CancellableOrder)
        val standard = StandardOrder(id = 1)
        assertTrue(standard is CancellableOrder)
    }
}
