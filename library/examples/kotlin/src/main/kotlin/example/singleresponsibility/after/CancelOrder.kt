package example.singleresponsibility.after

// Owns only the cancellation rule; notifying and auditing are delegated to
// its collaborators.
class CancelOrder(private val notifier: OrderNotifier, private val auditLog: AuditLog) {
    fun execute(order: Order, reason: String) {
        require(order.status != "shipped") { "cannot cancel a shipped order" }
        order.status = "cancelled"
        notifier.notifyCancelled(order, reason)
        auditLog.recordCancelled(order, reason)
    }
}
