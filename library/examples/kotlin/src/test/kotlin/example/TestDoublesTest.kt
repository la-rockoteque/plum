package example

import example.testdoubles.after.AuditLogger
import example.testdoubles.after.CancelOrder
import example.testdoubles.after.Mailer
import example.testdoubles.after.Order
import example.testdoubles.after.OrderRepository
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
        val order = BeforeOrder("order-1", "ada@example.com", 5.0)
        val exception = assertFailsWith<IllegalStateException> { BeforeCancelOrder().execute(order) }
        assertTrue(exception.message!!.contains("network unavailable"))
        // Nothing about the business outcome is observable: the order never even changed status.
        assertEquals("placed", order.status)
    }

    // Dummy: satisfies the constructor. If a test ever asserted on this, it wouldn't be a dummy anymore.
    private class NullAuditLogger : AuditLogger {
        override fun log(message: String) {
            error("dummy should never be called")
        }
    }

    // Fake: real find/save behaviour, no external system.
    private class InMemoryOrderRepository(vararg orders: Order) : OrderRepository {
        private val orders = orders.associateByTo(mutableMapOf()) { it.id }

        override fun findById(orderId: String): Order = orders.getValue(orderId)

        override fun save(order: Order) {
            orders[order.id] = order
        }
    }

    // Stub: a canned response. Nothing is recorded, nothing is verified.
    private class StubPaymentGateway : PaymentGateway {
        override fun charge(orderId: String, amount: Double) {}
    }

    // Mock: a hand-rolled expectation. The wrong call fails immediately; the right one is recorded.
    private class MockPaymentGateway(
        private val expectedOrderId: String,
        private val expectedAmount: Double,
    ) : PaymentGateway {
        var called: Boolean = false
            private set

        override fun charge(orderId: String, amount: Double) {
            check(orderId == expectedOrderId && amount == expectedAmount) {
                "unexpected charge: $orderId $amount"
            }
            called = true
        }
    }

    // Spy: records what was sent so the test can assert afterwards (state verification).
    private class SpyMailer : Mailer {
        val sent = mutableListOf<Pair<String, String>>()

        override fun send(to: String, message: String) {
            sent.add(to to message)
        }
    }

    private fun anOrder(fee: Double = 5.0) = Order("order-1", "ada@example.com", fee)

    @Test
    fun `after - dummy audit logger is passed but never called`() {
        val orders = InMemoryOrderRepository(anOrder())
        val useCase = CancelOrder(orders, StubPaymentGateway(), SpyMailer(), NullAuditLogger())
        useCase.execute("order-1") // would throw if the dummy were ever invoked
    }

    @Test
    fun `after - stub gateway returns a canned charge result`() {
        val orders = InMemoryOrderRepository(anOrder())
        val mailer = SpyMailer()
        CancelOrder(orders, StubPaymentGateway(), mailer, NullAuditLogger()).execute("order-1")
        // The stub's canned response is enough to let the use case reach the mailer.
        assertTrue(mailer.sent.isNotEmpty())
    }

    @Test
    fun `after - spy mailer records the message it sent`() {
        val orders = InMemoryOrderRepository(anOrder())
        val mailer = SpyMailer()
        CancelOrder(orders, StubPaymentGateway(), mailer, NullAuditLogger()).execute("order-1")
        assertEquals(listOf("ada@example.com" to "Your order order-1 was cancelled"), mailer.sent)
    }

    @Test
    fun `after - mock gateway accepts the expected charge`() {
        val orders = InMemoryOrderRepository(anOrder())
        val gateway = MockPaymentGateway(expectedOrderId = "order-1", expectedAmount = 5.0)
        CancelOrder(orders, gateway, SpyMailer(), NullAuditLogger()).execute("order-1")
        assertTrue(gateway.called)
    }

    @Test
    fun `after - mock gateway rejects an unexpected amount`() {
        val orders = InMemoryOrderRepository(anOrder(fee = 999.0))
        val gateway = MockPaymentGateway(expectedOrderId = "order-1", expectedAmount = 5.0)
        val exception = assertFailsWith<IllegalStateException> {
            CancelOrder(orders, gateway, SpyMailer(), NullAuditLogger()).execute("order-1")
        }
        assertTrue(exception.message!!.contains("unexpected charge"))
    }

    @Test
    fun `after - fake repository saves the cancelled order`() {
        val orders = InMemoryOrderRepository(anOrder())
        CancelOrder(orders, StubPaymentGateway(), SpyMailer(), NullAuditLogger()).execute("order-1")
        // Real behaviour: a later read reflects what an earlier write saved.
        assertEquals("cancelled", orders.findById("order-1").status)
    }
}
