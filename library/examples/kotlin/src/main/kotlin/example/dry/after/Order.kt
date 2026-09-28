package example.dry.after

// after: the rule lives once, on the order; both handlers call it.
const val CANCELLATION_WINDOW_MS = 24L * 60 * 60 * 1000

enum class OrderStatus { PENDING, SHIPPED, CANCELLED }

interface Clock {
    fun nowMs(): Long
}

data class Order(val id: Int, val status: OrderStatus, val placedAtMs: Long) {
    fun canBeCancelled(clock: Clock): Boolean {
        if (status != OrderStatus.PENDING) return false
        return clock.nowMs() - placedAtMs <= CANCELLATION_WINDOW_MS
    }
}

class CliCancelHandler {
    fun canCancel(order: Order, clock: Clock): Boolean = order.canBeCancelled(clock)
}

class ApiCancelHandler {
    fun canCancel(order: Order, clock: Clock): Boolean = order.canBeCancelled(clock)
}
