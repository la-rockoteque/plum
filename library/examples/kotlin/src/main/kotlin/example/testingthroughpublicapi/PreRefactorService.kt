package example.testingthroughpublicapi

class Order(val id: String, val total: Double) {
    var status: String = "placed"
}

interface OrderRepository {
    fun findById(orderId: String): Order
    fun save(order: Order)
}

interface Notifier {
    fun send(message: String)
}

data class CancellationOutcome(val orderId: String, val refundAmount: Double, val status: String)

// The unit's own internal collaborator: constructed by the service, never injected.
interface NotificationFormatter {
    fun format(orderId: String, refundAmount: Double): String
}

class DefaultNotificationFormatter : NotificationFormatter {
    override fun format(orderId: String, refundAmount: Double): String =
        "Order $orderId cancelled; refund ${"%.2f".format(refundAmount)}"
}

// Before the refactor: a separate fee helper and a plainly-named rate field.
class PreRefactorService(
    private val orders: OrderRepository,
    private val notifier: Notifier,
) {
    private val feeRate: Double = 0.1
    private val formatter: NotificationFormatter = DefaultNotificationFormatter()

    private fun calculateFee(order: Order): Double = Math.round(order.total * feeRate * 100) / 100.0

    private fun transitionStatus(order: Order) {
        order.status = "cancelled"
    }

    fun cancel(orderId: String): CancellationOutcome {
        val order = orders.findById(orderId)
        val fee = calculateFee(order)
        transitionStatus(order)
        val refund = Math.round((order.total - fee) * 100) / 100.0
        notifier.send(formatter.format(orderId, refund))
        orders.save(order)
        return CancellationOutcome(orderId, refund, order.status)
    }
}
