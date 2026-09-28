package example

import example.singleresponsibility.after.AuditLog
import example.singleresponsibility.after.Auditor
import example.singleresponsibility.after.CancelOrder
import example.singleresponsibility.after.Notifier
import example.singleresponsibility.after.Order as AfterOrder
import example.singleresponsibility.after.OrderNotifier
import example.singleresponsibility.after.OrderStatus as AfterOrderStatus
import example.singleresponsibility.before.Order as BeforeOrder
import example.singleresponsibility.before.OrderService
import example.singleresponsibility.before.OrderStatus as BeforeOrderStatus
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class SingleResponsibilityTest {
    // Satisfies CancelOrder's Notifier port; records only (orderId, reason),
    // never the wording OrderNotifier produces from it.
    private class NotifierSpy : Notifier {
        val notified = mutableListOf<Pair<Int, String>>()

        override fun notifyCancelled(order: AfterOrder, reason: String) {
            notified.add(order.id to reason)
        }
    }

    // Satisfies CancelOrder's Auditor port; records only (orderId, reason),
    // never the format AuditLog produces from it.
    private class AuditorSpy : Auditor {
        val audited = mutableListOf<Pair<Int, String>>()

        override fun recordCancelled(order: AfterOrder, reason: String) {
            audited.add(order.id to reason)
        }
    }

    @Test
    fun `before - cancelling a shipped order is rejected`() {
        val service = OrderService()
        val order = BeforeOrder(id = 1, customerName = "Ada", customerEmail = "ada@example.com", status = BeforeOrderStatus.SHIPPED)
        val error = assertFailsWith<IllegalArgumentException> { service.cancel(order, "changed my mind") }
        assertEquals("cannot cancel a shipped or cancelled order", error.message)
        assertEquals(BeforeOrderStatus.SHIPPED, order.status)
        assertTrue(service.sentEmails.isEmpty())
        assertTrue(service.auditLog.isEmpty())
    }

    @Test
    fun `before - cancelling a cancelled order is rejected`() {
        val service = OrderService()
        val order = BeforeOrder(id = 1, customerName = "Ada", customerEmail = "ada@example.com", status = BeforeOrderStatus.CANCELLED)
        val error = assertFailsWith<IllegalArgumentException> { service.cancel(order, "changed my mind") }
        assertEquals("cannot cancel a shipped or cancelled order", error.message)
        assertTrue(service.sentEmails.isEmpty())
        assertTrue(service.auditLog.isEmpty())
    }

    @Test
    fun `before - cancelling a pending order sends the confirmation email`() {
        val service = OrderService()
        val order = BeforeOrder(id = 1, customerName = "Ada", customerEmail = "ada@example.com")
        service.cancel(order, "changed my mind")
        assertEquals(BeforeOrderStatus.CANCELLED, order.status)
        assertEquals(listOf("Dear Ada, your order 1 was cancelled. Reason: changed my mind."), service.sentEmails)
    }

    @Test
    fun `before - cancelling a pending order writes an audit entry`() {
        val service = OrderService()
        val order = BeforeOrder(id = 1, customerName = "Ada", customerEmail = "ada@example.com")
        service.cancel(order, "changed my mind")
        assertEquals(listOf("1|CANCELLED|changed my mind"), service.auditLog)
    }

    @Test
    fun `before - the rule test is coupled to two email wordings`() {
        // Change cost: cancel() cannot be exercised without producing the email,
        // so the same test that proves the cancellation rule must also pin the
        // exact wording — for any reason text. Two reasons, two literal strings,
        // one test (this one, not a notifier's) to edit either way.
        val cases = listOf(
            "changed my mind" to "Dear Ada, your order 1 was cancelled. Reason: changed my mind.",
            "duplicate order" to "Dear Ada, your order 1 was cancelled. Reason: duplicate order.",
        )
        for ((reason, wording) in cases) {
            val service = OrderService()
            val order = BeforeOrder(id = 1, customerName = "Ada", customerEmail = "ada@example.com")
            service.cancel(order, reason)
            assertEquals(BeforeOrderStatus.CANCELLED, order.status)
            assertEquals(listOf(wording), service.sentEmails)
        }
    }

    @Test
    fun `after - cancelling a shipped order is rejected before notifying or auditing`() {
        val notifier = NotifierSpy()
        val auditLog = AuditorSpy()
        val useCase = CancelOrder(notifier, auditLog)
        val order = AfterOrder(id = 1, customerName = "Ada", customerEmail = "ada@example.com", status = AfterOrderStatus.SHIPPED)
        val error = assertFailsWith<IllegalArgumentException> { useCase.execute(order, "changed my mind") }
        assertEquals("cannot cancel a shipped or cancelled order", error.message)
        assertEquals(AfterOrderStatus.SHIPPED, order.status)
        assertTrue(notifier.notified.isEmpty())
        assertTrue(auditLog.audited.isEmpty())
    }

    @Test
    fun `after - cancelling a cancelled order is rejected before notifying or auditing`() {
        val notifier = NotifierSpy()
        val auditLog = AuditorSpy()
        val useCase = CancelOrder(notifier, auditLog)
        val order = AfterOrder(id = 1, customerName = "Ada", customerEmail = "ada@example.com", status = AfterOrderStatus.CANCELLED)
        val error = assertFailsWith<IllegalArgumentException> { useCase.execute(order, "changed my mind") }
        assertEquals("cannot cancel a shipped or cancelled order", error.message)
        assertTrue(notifier.notified.isEmpty())
        assertTrue(auditLog.audited.isEmpty())
    }

    @Test
    fun `after - cancelling a pending order notifies and audits through its ports`() {
        val notifier = NotifierSpy()
        val auditLog = AuditorSpy()
        val useCase = CancelOrder(notifier, auditLog)
        val order = AfterOrder(id = 1, customerName = "Ada", customerEmail = "ada@example.com")
        useCase.execute(order, "changed my mind")
        assertEquals(AfterOrderStatus.CANCELLED, order.status)
        assertEquals(listOf(1 to "changed my mind"), notifier.notified)
        assertEquals(listOf(1 to "changed my mind"), auditLog.audited)
    }

    @Test
    fun `after - the notifier formats the cancellation email on its own`() {
        val notifier = OrderNotifier()
        val order = AfterOrder(id = 1, customerName = "Ada", customerEmail = "ada@example.com")
        notifier.notifyCancelled(order, "changed my mind")
        assertEquals(listOf("Dear Ada, your order 1 was cancelled. Reason: changed my mind."), notifier.sent)
    }

    @Test
    fun `after - the audit log records the cancellation on its own`() {
        val auditLog = AuditLog()
        val order = AfterOrder(id = 1, customerName = "Ada", customerEmail = "ada@example.com")
        auditLog.recordCancelled(order, "changed my mind")
        assertEquals(listOf("1|CANCELLED|changed my mind"), auditLog.entries)
    }
}
