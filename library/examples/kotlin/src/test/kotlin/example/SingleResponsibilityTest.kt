package example

import example.singleresponsibility.after.AuditLog
import example.singleresponsibility.after.CancelOrder
import example.singleresponsibility.after.Order as AfterOrder
import example.singleresponsibility.after.OrderNotifier
import example.singleresponsibility.before.Order as BeforeOrder
import example.singleresponsibility.before.OrderService
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class SingleResponsibilityTest {
    @Test
    fun `before - cancelling a shipped order is rejected`() {
        val service = OrderService()
        val order = BeforeOrder(id = "O-1", customerName = "Ada", customerEmail = "ada@example.com", status = "shipped")
        val error = assertFailsWith<IllegalArgumentException> { service.cancel(order, "changed my mind") }
        assertEquals("cannot cancel a shipped order", error.message)
        assertEquals("shipped", order.status)
        assertTrue(service.sentEmails.isEmpty())
        assertTrue(service.auditLog.isEmpty())
    }

    @Test
    fun `before - cancelling a pending order sends the confirmation email`() {
        val service = OrderService()
        val order = BeforeOrder(id = "O-1", customerName = "Ada", customerEmail = "ada@example.com")
        service.cancel(order, "changed my mind")
        assertEquals("cancelled", order.status)
        assertEquals(listOf("Dear Ada, your order O-1 was cancelled. Reason: changed my mind."), service.sentEmails)
    }

    @Test
    fun `before - cancelling a pending order writes an audit entry`() {
        val service = OrderService()
        val order = BeforeOrder(id = "O-1", customerName = "Ada", customerEmail = "ada@example.com")
        service.cancel(order, "changed my mind")
        assertEquals(listOf("O-1|CANCELLED|changed my mind"), service.auditLog)
    }

    @Test
    fun `after - cancelling a shipped order is rejected before notifying or auditing`() {
        val notifier = OrderNotifier()
        val auditLog = AuditLog()
        val useCase = CancelOrder(notifier, auditLog)
        val order = AfterOrder(id = "O-1", customerName = "Ada", customerEmail = "ada@example.com", status = "shipped")
        val error = assertFailsWith<IllegalArgumentException> { useCase.execute(order, "changed my mind") }
        assertEquals("cannot cancel a shipped order", error.message)
        assertEquals("shipped", order.status)
        assertTrue(notifier.sent.isEmpty())
        assertTrue(auditLog.entries.isEmpty())
    }

    @Test
    fun `after - cancelling a pending order notifies and audits through its collaborators`() {
        val notifier = OrderNotifier()
        val auditLog = AuditLog()
        val useCase = CancelOrder(notifier, auditLog)
        val order = AfterOrder(id = "O-1", customerName = "Ada", customerEmail = "ada@example.com")
        useCase.execute(order, "changed my mind")
        assertEquals("cancelled", order.status)
        assertEquals(listOf("Dear Ada, your order O-1 was cancelled. Reason: changed my mind."), notifier.sent)
        assertEquals(listOf("O-1|CANCELLED|changed my mind"), auditLog.entries)
    }

    @Test
    fun `after - the notifier formats the cancellation email on its own`() {
        val notifier = OrderNotifier()
        val order = AfterOrder(id = "O-1", customerName = "Ada", customerEmail = "ada@example.com")
        notifier.notifyCancelled(order, "changed my mind")
        assertEquals(listOf("Dear Ada, your order O-1 was cancelled. Reason: changed my mind."), notifier.sent)
    }

    @Test
    fun `after - the audit log records the cancellation on its own`() {
        val auditLog = AuditLog()
        val order = AfterOrder(id = "O-1", customerName = "Ada", customerEmail = "ada@example.com")
        auditLog.recordCancelled(order, "changed my mind")
        assertEquals(listOf("O-1|CANCELLED|changed my mind"), auditLog.entries)
    }
}
