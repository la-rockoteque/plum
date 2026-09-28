package example.testingthroughpublicapi

enum class OrderStatus {
    PENDING,
    SHIPPED,
    CANCELLED,
}

class Order(val id: Int, val amountMinor: Int) {
    var status: OrderStatus = OrderStatus.PENDING
}

interface OrderRepository {
    fun findById(orderId: Int): Order
    fun save(order: Order)
}

interface Notifier {
    fun send(message: String)
}

data class CancellationOutcome(val orderId: Int, val refundAmountMinor: Int, val status: OrderStatus)

// The unit's own internal collaborator: constructed by the service, never injected.
interface NotificationFormatter {
    fun format(orderId: Int, refundAmountMinor: Int): String
}

class DefaultNotificationFormatter : NotificationFormatter {
    override fun format(orderId: Int, refundAmountMinor: Int): String =
        "Order $orderId cancelled; refund $refundAmountMinor"
}

// Before the refactor: a separate fee helper and a plainly-named rate field.
class PreRefactorService(
    private val orders: OrderRepository,
    private val notifier: Notifier,
) {
    private val feeRate: Double = 0.1
    private val formatter: NotificationFormatter = DefaultNotificationFormatter()

    private fun calculateFee(order: Order): Int = Math.round(order.amountMinor * feeRate).toInt()

    private fun transitionStatus(order: Order) {
        order.status = OrderStatus.CANCELLED
    }

    fun cancel(orderId: Int): CancellationOutcome {
        val order = orders.findById(orderId)
        val fee = calculateFee(order)
        transitionStatus(order)
        val refund = order.amountMinor - fee
        notifier.send(formatter.format(orderId, refund))
        orders.save(order)
        return CancellationOutcome(orderId, refund, order.status)
    }
}
