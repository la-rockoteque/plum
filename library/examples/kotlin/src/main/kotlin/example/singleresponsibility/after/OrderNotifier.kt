package example.singleresponsibility.after

// Owns the wording of the cancellation email — its only reason to change.
// Satisfies CancelOrder's Notifier port structurally; nothing declares it.
class OrderNotifier {
    val sent = mutableListOf<String>()

    fun notifyCancelled(order: Order, reason: String) {
        sent.add("Dear ${order.customerName}, your order ${order.id} was cancelled. Reason: $reason.")
    }
}
