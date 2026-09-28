package example.liskovsubstitution.before

// Written against the Order contract. Because GiftOrder strengthens that
// contract's precondition, this caller has to know about GiftOrder by name
// to avoid the broken cancellation.
class CancelExpiredOrders {
    fun execute(orders: List<Order>, reason: String): Pair<List<Int>, List<Int>> {
        val cancelled = mutableListOf<Int>()
        val skipped = mutableListOf<Int>()
        for (order in orders) {
            if (order is GiftOrder) {
                skipped.add(order.id)
                continue
            }
            order.cancel(reason)
            cancelled.add(order.id)
        }
        return cancelled to skipped
    }
}

// A second caller against the same Order contract, forced to grow the same
// type check as CancelExpiredOrders — the change cost of the violation is
// paid twice.
class CustomerServiceCancelTool {
    fun cancel(order: Order, reason: String): String {
        if (order is GiftOrder) {
            return "order ${order.id} must be cancelled by phone: gift orders can't be cancelled online"
        }
        order.cancel(reason)
        return "order ${order.id} cancelled: $reason"
    }
}
