package example.singleresponsibility.after

// Owns the wording of the cancellation email — its only reason to change.
class OrderNotifier {
    val sent = mutableListOf<String>()

    fun notifyCancelled(order: Order, reason: String) {
        sent.add("Dear ${order.customerName}, your order ${order.id} was cancelled. Reason: $reason.")
    }
}
