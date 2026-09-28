package example

import example.testingthroughpublicapi.CancellationOutcome
import example.testingthroughpublicapi.NotificationFormatter
import example.testingthroughpublicapi.Notifier
import example.testingthroughpublicapi.Order
import example.testingthroughpublicapi.OrderRepository
import example.testingthroughpublicapi.PostRefactorService
import example.testingthroughpublicapi.PreRefactorService
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class TestingThroughPublicApiTest {

    // Fake: real find/save behaviour, no external system.
    private class InMemoryOrderRepository(vararg orders: Order) : OrderRepository {
        private val orders = orders.associateByTo(mutableMapOf()) { it.id }

        override fun findById(orderId: String): Order = orders.getValue(orderId)

        override fun save(order: Order) {
            orders[order.id] = order
        }
    }

    // Spy: records what was sent so the test can assert afterwards.
    private class SpyNotifier : Notifier {
        val sent = mutableListOf<String>()

        override fun send(message: String) {
            sent.add(message)
        }
    }

    // A hand-rolled double for the service's OWN internal collaborator - not a port.
    private class MockNotificationFormatter : NotificationFormatter {
        var calledOrderId: String? = null
        var calledRefundAmount: Double? = null

        override fun format(orderId: String, refundAmount: Double): String {
            calledOrderId = orderId
            calledRefundAmount = refundAmount
            return "mocked notification"
        }
    }

    private fun anOrder() = Order("order-1", 50.0)

    // --- before: internal-poking tests, via reflection since Kotlin private is truly private ---

    @Test
    fun `before - poking the private fee helper and field passes against the pre-refactor implementation`() {
        val order = anOrder()
        val service = PreRefactorService(InMemoryOrderRepository(order), SpyNotifier())

        // Reach past cancel() and call the private helper directly.
        val calculateFee = service.javaClass.getDeclaredMethod("calculateFee", Order::class.java)
        calculateFee.isAccessible = true
        assertEquals(5.0, calculateFee.invoke(service, order) as Double)

        // Assert on a private field instead of an observable outcome.
        val feeRate = service.javaClass.getDeclaredField("feeRate")
        feeRate.isAccessible = true
        assertEquals(0.1, feeRate.getDouble(service))
    }

    @Test
    fun `before - mocking the service's own formatter passes but couples the test to implementation`() {
        val service = PreRefactorService(InMemoryOrderRepository(anOrder()), SpyNotifier())
        val mock = MockNotificationFormatter()

        // Reach in and replace a collaborator the service built for itself.
        val formatter = service.javaClass.getDeclaredField("formatter")
        formatter.isAccessible = true
        formatter.set(service, mock)

        service.cancel("order-1")

        assertEquals("order-1", mock.calledOrderId)
        assertEquals(45.0, mock.calledRefundAmount)
    }

    @Test
    fun `before - the same private-poking assertions no longer hold after a pure refactor`() {
        val service = PostRefactorService(InMemoryOrderRepository(anOrder()), SpyNotifier())

        // The helper the pre-refactor test called directly is gone: inlined into cancel().
        assertNull(service.javaClass.declaredMethods.find { it.name == "calculateFee" })

        // The field the pre-refactor test asserted on directly was renamed.
        assertNull(service.javaClass.declaredFields.find { it.name == "feeRate" })
        val renamed = service.javaClass.getDeclaredField("cancellationFeeRate")
        renamed.isAccessible = true
        assertEquals(0.1, renamed.getDouble(service))
    }

    // --- after: public-API tests, run unmodified against both implementations -------------------

    private fun assertCancellingOrder1BehavesCorrectly(
        cancel: (String) -> CancellationOutcome,
        orders: InMemoryOrderRepository,
        notifier: SpyNotifier,
    ) {
        val outcome = cancel("order-1")
        assertEquals("order-1", outcome.orderId)
        assertEquals(45.0, outcome.refundAmount)
        assertEquals("cancelled", outcome.status)

        // Observable via the fake repository: state was actually persisted.
        assertEquals("cancelled", orders.findById("order-1").status)

        // Observable via the notifier spy: the right message was sent.
        assertEquals(listOf("Order order-1 cancelled; refund 45.00"), notifier.sent)
    }

    @Test
    fun `after - cancelling through the public api behaves identically against the pre-refactor implementation`() {
        val orders = InMemoryOrderRepository(anOrder())
        val notifier = SpyNotifier()
        val service = PreRefactorService(orders, notifier)
        assertCancellingOrder1BehavesCorrectly(service::cancel, orders, notifier)
    }

    @Test
    fun `after - cancelling through the public api behaves identically against the post-refactor implementation`() {
        val orders = InMemoryOrderRepository(anOrder())
        val notifier = SpyNotifier()
        val service = PostRefactorService(orders, notifier)
        assertCancellingOrder1BehavesCorrectly(service::cancel, orders, notifier)
    }
}
