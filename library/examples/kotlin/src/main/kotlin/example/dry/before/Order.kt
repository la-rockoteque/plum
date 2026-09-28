package example.dry.before

// before: the cancellation-eligibility rule is copy-pasted into a CLI and an API handler.
const val CANCELLATION_WINDOW_MS = 24L * 60 * 60 * 1000

enum class OrderStatus { PENDING, SHIPPED, CANCELLED }

data class Order(val id: Int, val status: OrderStatus, val placedAtMs: Long)

interface Clock {
    fun nowMs(): Long
}

// Got the window check in a later bug fix.
class CliCancelHandler {
    fun canCancel(order: Order, clock: Clock): Boolean {
        if (order.status != OrderStatus.PENDING) return false
        return clock.nowMs() - order.placedAtMs <= CANCELLATION_WINDOW_MS
    }
}

// Copy-pasted from the CLI handler before the window check was added.
class ApiCancelHandler {
    fun canCancel(order: Order, clock: Clock): Boolean = order.status == OrderStatus.PENDING
}
