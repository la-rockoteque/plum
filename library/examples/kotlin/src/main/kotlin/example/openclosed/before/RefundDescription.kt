package example.openclosed.before

// The same switch, copy-pasted here for the customer-facing message — kept in
// sync for express and subscription, never updated when custom-made orders
// were added.
class RefundDescription {
    fun describe(order: Order): String = when (order.type) {
        STANDARD -> if (order.pending) "Full refund, order not yet processed" else "No refund, order already shipped"
        EXPRESS -> "Refund minus a flat express handling fee"
        SUBSCRIPTION -> "Prorated refund for unused months"
        else -> "Refund processed"
    }
}
