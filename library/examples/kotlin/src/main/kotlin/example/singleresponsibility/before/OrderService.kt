package example.singleresponsibility.before

data class Order(
    val id: String,
    val customerName: String,
    val customerEmail: String,
    var status: String = "pending",
)

// Cancels an order, formats the customer email, and writes the audit log —
// three reasons to change: the cancellation rule, the email wording, and the
// audit format.
class OrderService {
    val sentEmails = mutableListOf<String>()
    val auditLog = mutableListOf<String>()

    fun cancel(order: Order, reason: String) {
        require(order.status != "shipped") { "cannot cancel a shipped order" }
        order.status = "cancelled"
        sentEmails.add("Dear ${order.customerName}, your order ${order.id} was cancelled. Reason: $reason.")
        auditLog.add("${order.id}|CANCELLED|$reason")
    }
}
