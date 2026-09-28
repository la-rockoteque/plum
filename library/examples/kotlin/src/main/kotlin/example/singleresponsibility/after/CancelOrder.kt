package example.singleresponsibility.after

interface Notifier {
    fun notifyCancelled(order: Order, reason: String)
}

interface Auditor {
    fun recordCancelled(order: Order, reason: String)
}

// Owns only the cancellation rule; notifying and auditing are delegated to
// ports it declares, not to concrete collaborators.
class CancelOrder(private val notifier: Notifier, private val auditLog: Auditor) {
    fun execute(order: Order, reason: String) {
        require(order.status != OrderStatus.SHIPPED && order.status != OrderStatus.CANCELLED) {
            "cannot cancel a shipped or cancelled order"
        }
        order.status = OrderStatus.CANCELLED
        notifier.notifyCancelled(order, reason)
        auditLog.recordCancelled(order, reason)
    }
}
