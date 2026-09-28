package example.testingthroughpublicapi

// After a behaviour-preserving refactor: the fee helper is inlined and the rate field renamed.
// A caller of cancel() cannot tell this apart from PreRefactorService - same inputs, same outcome,
// same stored state, same notification. Only the private shape changed.
class PostRefactorService(
    private val orders: OrderRepository,
    private val notifier: Notifier,
) {
    private val cancellationFeeRate: Double = 0.1
    private val formatter: NotificationFormatter = DefaultNotificationFormatter()

    private fun transitionStatus(order: Order) {
        order.status = "cancelled"
    }

    fun cancel(orderId: String): CancellationOutcome {
        val order = orders.findById(orderId)
        val fee = Math.round(order.total * cancellationFeeRate * 100) / 100.0 // calculateFee() inlined here
        transitionStatus(order)
        val refund = Math.round((order.total - fee) * 100) / 100.0
        notifier.send(formatter.format(orderId, refund))
        orders.save(order)
        return CancellationOutcome(orderId, refund, order.status)
    }
}
