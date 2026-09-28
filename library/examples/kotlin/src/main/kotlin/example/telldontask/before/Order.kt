package example.telldontask.before

// Teaching artifact: three callers each ask Order for its state, decide in their own if, and
// set the fields back. The API handler gets it right; the nightly job forgets the refund; the
// admin tool never checks whether the order already shipped.

enum class OrderStatus { PENDING, SHIPPED, CANCELLED }

interface Clock {
    fun nowMs(): Long
}

class Order(
    val id: Int,
    var status: OrderStatus,
    val amountPaidCents: Long,
    val shippedAtMs: Long? = null,
    var cancelledAtMs: Long? = null,
    var refundDueCents: Long = 0,
)

// The customer-facing cancel endpoint. Gets the rule right.
class ApiCancelHandler {
    fun cancel(order: Order, clock: Clock) {
        if (order.status != OrderStatus.PENDING) return
        order.status = OrderStatus.CANCELLED
        order.cancelledAtMs = clock.nowMs()
        order.refundDueCents = order.amountPaidCents
    }
}

// Auto-cancels stale pending orders. Forgot to carry the refund forward.
class NightlyCancelJob {
    fun cancel(order: Order, clock: Clock) {
        if (order.status != OrderStatus.PENDING) return
        order.status = OrderStatus.CANCELLED
        order.cancelledAtMs = clock.nowMs()
        // Bug: refundDueCents is never set, even though the customer paid.
    }
}

// Lets support force-cancel an order by id. Never checks the current status first.
class AdminCancelTool {
    fun cancel(order: Order, clock: Clock) {
        // Bug: no status check, so a shipped order can be "cancelled" too.
        order.status = OrderStatus.CANCELLED
        order.cancelledAtMs = clock.nowMs()
        order.refundDueCents = order.amountPaidCents
    }
}
