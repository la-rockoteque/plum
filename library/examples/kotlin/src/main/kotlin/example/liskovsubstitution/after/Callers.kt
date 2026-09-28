package example.liskovsubstitution.after

// Depends only on CancellableOrder, so it works for every subtype that
// implements it — no type check, and no way to hand it a GiftOrder by
// mistake.
class CancelExpiredOrders {
    fun execute(orders: List<CancellableOrder>, reason: String): List<Int> {
        val cancelled = mutableListOf<Int>()
        for (order in orders) {
            order.cancel(reason)
            cancelled.add(order.id)
        }
        return cancelled
    }
}

// Same capability, same absence of type checks.
class CustomerServiceCancelTool {
    fun cancel(order: CancellableOrder, reason: String): String {
        order.cancel(reason)
        return "order ${order.id} cancelled: $reason"
    }
}
