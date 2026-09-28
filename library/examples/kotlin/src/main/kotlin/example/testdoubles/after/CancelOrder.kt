package example.testdoubles.after

class Order(val id: String, val customerEmail: String, val cancellationFee: Double) {
    var status: String = "placed"
}

interface OrderRepository {
    fun findById(orderId: String): Order
    fun save(order: Order)
}

interface PaymentGateway {
    fun charge(orderId: String, amount: Double)
}

interface Mailer {
    fun send(to: String, message: String)
}

interface AuditLogger {
    fun log(message: String)
}

// Every collaborator is a port; the composition root decides which double or adapter plugs in.
class CancelOrder(
    private val orders: OrderRepository,
    private val gateway: PaymentGateway,
    private val mailer: Mailer,
    @Suppress("unused") private val auditLogger: AuditLogger, // never called: a dummy satisfies this in tests
) {
    fun execute(orderId: String) {
        val order = orders.findById(orderId)
        gateway.charge(order.id, order.cancellationFee)
        order.status = "cancelled"
        mailer.send(order.customerEmail, "Your order ${order.id} was cancelled")
        orders.save(order)
    }
}
