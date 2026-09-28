package example

import example.domainevents.after.CancelOrderService
import example.domainevents.after.EventDispatcher
import example.domainevents.after.InMemoryOrderRepository
import example.domainevents.after.Order
import example.domainevents.after.OrderCancelled
import example.domainevents.after.RecordLoyaltyCancellationHandler
import example.domainevents.after.ReleaseInventoryHandler
import example.domainevents.after.SendCancellationEmailHandler
import example.domainevents.before.Order as BeforeOrder
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class DomainEventsTest {

    private class FixedClock(private val ms: Long) : example.domainevents.after.Clock {
        override fun nowMs(): Long = ms
    }

    private class FakeInventoryService :
        example.domainevents.before.InventoryService,
        example.domainevents.after.InventoryService {
        val released = mutableListOf<Int>()
        override fun release(orderId: Int) {
            released.add(orderId)
        }
    }

    private class FakeMailer :
        example.domainevents.before.Mailer,
        example.domainevents.after.Mailer {
        val sent = mutableListOf<Int>()
        override fun sendCancellationEmail(orderId: Int) {
            sent.add(orderId)
        }
    }

    private class MailerUnavailableException(message: String) : Exception(message)

    private class FailingMailer :
        example.domainevents.before.Mailer,
        example.domainevents.after.Mailer {
        override fun sendCancellationEmail(orderId: Int): Unit =
            throw MailerUnavailableException("mailer unavailable")
    }

    private class FakeLoyaltyLedger :
        example.domainevents.before.LoyaltyLedger,
        example.domainevents.after.LoyaltyLedger {
        val recorded = mutableListOf<Int>()
        override fun recordCancellation(orderId: Int) {
            recorded.add(orderId)
        }
    }

    private class StorageUnavailableException(message: String) : Exception(message)

    private class FailingSaveOrderRepository : InMemoryOrderRepository() {
        var failOnSave = false
        override fun save(order: Order) {
            if (failOnSave) throw StorageUnavailableException("storage unavailable")
            super.save(order)
        }
    }

    @Test
    fun `before - cancelling calls the inventory mailer and loyalty collaborators directly`() {
        val inventory = FakeInventoryService()
        val mailer = FakeMailer()
        val loyalty = FakeLoyaltyLedger()
        val order = BeforeOrder(1, inventory, mailer, loyalty)

        order.cancel("customer request")

        assertEquals(listOf(1), inventory.released)
        assertEquals(listOf(1), mailer.sent)
        assertEquals(listOf(1), loyalty.recorded)
        assertEquals("cancelled", order.status)
    }

    @Test
    fun `before - a failing mailer leaves inventory released but the order not cancelled`() {
        val inventory = FakeInventoryService()
        val loyalty = FakeLoyaltyLedger()
        val order = BeforeOrder(1, inventory, FailingMailer(), loyalty)

        assertFailsWith<MailerUnavailableException> { order.cancel("customer request") }

        assertEquals(listOf(1), inventory.released) // already ran
        assertTrue(loyalty.recorded.isEmpty()) // never reached
        assertEquals("pending", order.status) // inconsistent: inventory thinks it's released, order disagrees
    }

    @Test
    fun `after - cancel records exactly one OrderCancelled event with the right data`() {
        val order = Order(1)

        order.cancel("customer request", FixedClock(1000))
        val events = order.pullEvents()

        assertEquals(listOf(OrderCancelled(1, "customer request", 1000)), events)
        assertEquals("cancelled", order.status)
    }

    @Test
    fun `after - cancelling through the service dispatches to every registered handler after a successful save`() {
        val repo = InMemoryOrderRepository()
        repo.save(Order(1))
        val dispatcher = EventDispatcher()
        val inventory = FakeInventoryService()
        val mailer = FakeMailer()
        val loyalty = FakeLoyaltyLedger()
        dispatcher.register(OrderCancelled::class.java, ReleaseInventoryHandler(inventory))
        dispatcher.register(OrderCancelled::class.java, SendCancellationEmailHandler(mailer))
        dispatcher.register(OrderCancelled::class.java, RecordLoyaltyCancellationHandler(loyalty))
        val service = CancelOrderService(repo, dispatcher, FixedClock(1000))

        service.cancel(1, "customer request")

        assertEquals(listOf(1), inventory.released)
        assertEquals(listOf(1), mailer.sent)
        assertEquals(listOf(1), loyalty.recorded)
        assertEquals("cancelled", repo.get(1)?.status)
    }

    @Test
    fun `after - events are not dispatched when the save fails`() {
        val repo = FailingSaveOrderRepository()
        repo.save(Order(1))
        val dispatcher = EventDispatcher()
        val mailer = FakeMailer()
        dispatcher.register(OrderCancelled::class.java, SendCancellationEmailHandler(mailer))
        val service = CancelOrderService(repo, dispatcher, FixedClock(1000))
        repo.failOnSave = true

        assertFailsWith<StorageUnavailableException> { service.cancel(1, "customer request") }

        assertTrue(mailer.sent.isEmpty())
    }

    @Test
    fun `after - the inventory handler releases inventory for the cancelled order`() {
        val inventory = FakeInventoryService()
        val handler = ReleaseInventoryHandler(inventory)

        handler.handle(OrderCancelled(1, "customer request", 1000))

        assertEquals(listOf(1), inventory.released)
    }

    @Test
    fun `after - the mailer handler sends a cancellation email`() {
        val mailer = FakeMailer()
        val handler = SendCancellationEmailHandler(mailer)

        handler.handle(OrderCancelled(1, "customer request", 1000))

        assertEquals(listOf(1), mailer.sent)
    }

    @Test
    fun `after - the loyalty handler records the cancellation`() {
        val loyalty = FakeLoyaltyLedger()
        val handler = RecordLoyaltyCancellationHandler(loyalty)

        handler.handle(OrderCancelled(1, "customer request", 1000))

        assertEquals(listOf(1), loyalty.recorded)
    }

    @Test
    fun `after - a failing handler does not undo the cancellation`() {
        val repo = InMemoryOrderRepository()
        repo.save(Order(1))
        val dispatcher = EventDispatcher()
        val inventory = FakeInventoryService()
        val loyalty = FakeLoyaltyLedger()
        dispatcher.register(OrderCancelled::class.java, ReleaseInventoryHandler(inventory))
        dispatcher.register(OrderCancelled::class.java, SendCancellationEmailHandler(FailingMailer()))
        dispatcher.register(OrderCancelled::class.java, RecordLoyaltyCancellationHandler(loyalty))
        val service = CancelOrderService(repo, dispatcher, FixedClock(1000))

        assertFailsWith<MailerUnavailableException> { service.cancel(1, "customer request") }

        val saved = repo.get(1)
        assertNotNull(saved)
        assertEquals("cancelled", saved.status) // the save already committed before the handler ran
        assertEquals(listOf(1), inventory.released) // handler before the failing one still ran
        assertTrue(loyalty.recorded.isEmpty()) // handler after the failing one never ran
    }
}
