package example.singleresponsibility.before

enum class OrderStatus { PENDING, SHIPPED, CANCELLED }

data class Order(
    val id: Int,
    val customerName: String,
    val customerEmail: String,
    var status: OrderStatus = OrderStatus.PENDING,
)

// Cancels an order, formats the customer email, and writes the audit log —
// three reasons to change: the cancellation rule, the email wording, and the
// audit format.
class OrderService {
    val sentEmails = mutableListOf<String>()
    val auditLog = mutableListOf<String>()

    fun cancel(order: Order, reason: String) {
        require(order.status != OrderStatus.SHIPPED && order.status != OrderStatus.CANCELLED) {
            "cannot cancel a shipped or cancelled order"
        }
        order.status = OrderStatus.CANCELLED
        sentEmails.add("Dear ${order.customerName}, your order ${order.id} was cancelled. Reason: $reason.")
        auditLog.add("${order.id}|CANCELLED|$reason")
    }
}
