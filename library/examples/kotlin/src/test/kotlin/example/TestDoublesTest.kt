package example

import example.testdoubles.after.AuditLogger
import example.testdoubles.after.CancelOrder
import example.testdoubles.after.ChargeResult
import example.testdoubles.after.Mailer
import example.testdoubles.after.Order
import example.testdoubles.after.OrderRepository
import example.testdoubles.after.OrderStatus
import example.testdoubles.after.PaymentGateway
import example.testdoubles.before.CancelOrder as BeforeCancelOrder
import example.testdoubles.before.Order as BeforeOrder
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class TestDoublesTest {
    @Test
    fun `before - cancelling an order blows up instead of completing`() {
        val order = BeforeOrder(1, "ada@example.com", 500)
        val exception = assertFailsWith<IllegalStateException> { BeforeCancelOrder().execute(order) }
        assertTrue(exception.message!!.contains("network unavailable"))
        // Nothing about the business outcome is observable: the order never even changed status.
        assertEquals("pending", order.status)
    }

    // Dummy: satisfies the constructor. If a test ever asserted on this, it wouldn't be a dummy anymore.
    private class NullAuditLogger : AuditLogger {
        override fun log(message: String) {
            error("dummy should never be called")
        }
    }

    // Spy: records the decline message so the test can assert afterwards. The audit
    // logger becomes a real collaborator once a charge is declined.
    private class SpyAuditLogger : AuditLogger {
        val messages = mutableListOf<String>()

        override fun log(message: String) {
            messages.add(message)
        }
    }

    // Fake: real get/save behaviour, no external system. Copies on write and on read, so
    // mutating what get() returns never leaks into storage until save() is called.
    private class InMemoryOrderRepository(vararg initial: Order) : OrderRepository {
        private val orders = mutableMapOf<Int, Order>().apply {
            for (order in initial) put(order.id, copyOf(order))
        }

        override fun get(orderId: Int): Order = copyOf(orders.getValue(orderId))

        override fun save(order: Order) {
            orders[order.id] = copyOf(order)
        }

        private fun copyOf(order: Order): Order =
            Order(order.id, order.customerEmail, order.amountMinor).also { it.status = order.status }
    }

    // Stub: a canned response. Nothing is recorded, nothing is verified.
    private class StubPaymentGateway(private val result: ChargeResult) : PaymentGateway {
        override fun charge(orderId: Int, amountMinor: Int): ChargeResult = result
    }

    // Mock: a hand-rolled expectation. The wrong call fails immediately; the right one is recorded.
    private class MockPaymentGateway(
        private val expectedOrderId: Int,
        private val expectedAmountMinor: Int,
    ) : PaymentGateway {
        var called: Boolean = false
            private set

        override fun charge(orderId: Int, amountMinor: Int): ChargeResult {
            check(orderId == expectedOrderId && amountMinor == expectedAmountMinor) {
                "unexpected charge: $orderId $amountMinor"
            }
            called = true
            return ChargeResult.APPROVED
        }
    }

    // Spy: records what was sent so the test can assert afterwards (state verification).
    private class SpyMailer : Mailer {
        val sent = mutableListOf<Pair<String, String>>()

        override fun send(to: String, message: String) {
            sent.add(to to message)
        }
    }

    private fun anOrder(amountMinor: Int = 500) = Order(1, "ada@example.com", amountMinor)

    @Test
    fun `after - dummy audit logger is passed but never called`() {
        val orders = InMemoryOrderRepository(anOrder())
        val useCase = CancelOrder(orders, StubPaymentGateway(ChargeResult.APPROVED), SpyMailer(), NullAuditLogger())
        useCase.execute(1) // would throw if the dummy were ever invoked
    }

    @Test
    fun `after - stub gateway returns a canned decline and the order is not cancelled`() {
        val orders = InMemoryOrderRepository(anOrder())
        val audit = SpyAuditLogger()
        CancelOrder(orders, StubPaymentGateway(ChargeResult.DECLINED), SpyMailer(), audit).execute(1)
        // The stub's canned decline is enough to keep the order out of the cancelled state...
        assertEquals(OrderStatus.PENDING, orders.get(1).status)
        // ...and it drove a real call to the audit logger, which is no longer dead code.
        assertEquals(listOf("charge declined for order 1"), audit.messages)
    }

    @Test
    fun `after - spy mailer records the message it sent`() {
        val orders = InMemoryOrderRepository(anOrder())
        val mailer = SpyMailer()
        CancelOrder(orders, StubPaymentGateway(ChargeResult.APPROVED), mailer, NullAuditLogger()).execute(1)
        assertEquals(listOf("ada@example.com" to "Your order 1 was cancelled"), mailer.sent)
    }

    @Test
    fun `after - mock gateway fails immediately on the wrong charge but accepts the right one`() {
        val wrongOrders = InMemoryOrderRepository(anOrder(amountMinor = 99900))
        val wrongGateway = MockPaymentGateway(expectedOrderId = 1, expectedAmountMinor = 500)
        val exception = assertFailsWith<IllegalStateException> {
            CancelOrder(wrongOrders, wrongGateway, SpyMailer(), NullAuditLogger()).execute(1)
        }
        assertTrue(exception.message!!.contains("unexpected charge"))

        val orders = InMemoryOrderRepository(anOrder())
        val gateway = MockPaymentGateway(expectedOrderId = 1, expectedAmountMinor = 500)
        CancelOrder(orders, gateway, SpyMailer(), NullAuditLogger()).execute(1)
        assertTrue(gateway.called)
    }

    @Test
    fun `after - fake repository saves the cancelled order`() {
        val orders = InMemoryOrderRepository(anOrder())
        CancelOrder(orders, StubPaymentGateway(ChargeResult.APPROVED), SpyMailer(), NullAuditLogger()).execute(1)
        // Real behaviour: a later read reflects what an earlier write saved. If save()
        // were never called, get() would still return the untouched copy stored at
        // construction time.
        assertEquals(OrderStatus.CANCELLED, orders.get(1).status)
    }
}
