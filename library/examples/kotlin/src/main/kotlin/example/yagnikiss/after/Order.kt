package example.yagnikiss.after

// after: delete down to what's actually called — one method with the rule.
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
