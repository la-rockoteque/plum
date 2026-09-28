package example.testdoubles.after

enum class OrderStatus { PENDING, SHIPPED, CANCELLED }

enum class ChargeResult { APPROVED, DECLINED }

class Order(val id: Int, val customerEmail: String, val amountMinor: Int) {
    var status: OrderStatus = OrderStatus.PENDING
}

interface OrderRepository {
    fun get(orderId: Int): Order
    fun save(order: Order)
}

interface PaymentGateway {
    fun charge(orderId: Int, amountMinor: Int): ChargeResult
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
    private val auditLogger: AuditLogger,
) {
    fun execute(orderId: Int) {
        val order = orders.get(orderId)
        val result = gateway.charge(order.id, order.amountMinor)
        if (result == ChargeResult.DECLINED) {
            // A declined charge is a legitimate business outcome, not a crash: the audit
            // logger is a real collaborator on this path, even though the happy path
            // never touches it.
            auditLogger.log("charge declined for order ${order.id}")
            return
        }
        order.status = OrderStatus.CANCELLED
        mailer.send(order.customerEmail, "Your order ${order.id} was cancelled")
        orders.save(order)
    }
}
