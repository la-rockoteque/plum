package example.telldontask.after

// Callers tell the order to cancel itself; Order owns the rule, the timestamp and the refund.
// Setters disappear, and the invalid transition (cancelling a shipped order) is rejected once,
// inside Order, instead of missed by whichever caller forgot to check.

enum class OrderStatus { PENDING, SHIPPED, CANCELLED }

interface Clock {
    fun nowMs(): Long
}

class Order(
    val id: Int,
    status: OrderStatus,
    val amountPaidCents: Long,
    val shippedAtMs: Long? = null,
) {
    var status: OrderStatus = status
        private set
    var cancelledAtMs: Long? = null
        private set
    var refundDueCents: Long = 0
        private set

    fun cancel(clock: Clock) {
        check(status == OrderStatus.PENDING) { "cannot cancel an order with status $status" }
        status = OrderStatus.CANCELLED
        cancelledAtMs = clock.nowMs()
        refundDueCents = amountPaidCents
    }
}

class ApiCancelHandler {
    fun cancel(order: Order, clock: Clock) = order.cancel(clock)
}

class NightlyCancelJob {
    fun cancel(order: Order, clock: Clock) = order.cancel(clock)
}

class AdminCancelTool {
    fun cancel(order: Order, clock: Clock) = order.cancel(clock)
}
