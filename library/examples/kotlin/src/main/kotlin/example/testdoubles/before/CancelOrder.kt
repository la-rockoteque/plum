package example.testdoubles.before

// Stand-in for a real SMTP client: this library never opens a socket.
class SmtpMailer {
    fun send(to: String, message: String) {
        error("network unavailable")
    }
}

// Stand-in for a real payment-gateway HTTP client.
class HttpPaymentGateway {
    fun charge(orderId: Int, amountMinor: Int) {
        error("network unavailable")
    }
}

class Order(val id: Int, val customerEmail: String, val amountMinor: Int) {
    var status: String = "pending"
}

// Self-constructs its collaborators: no test can observe anything but the crash.
class CancelOrder {
    private val gateway = HttpPaymentGateway()
    private val mailer = SmtpMailer()

    fun execute(order: Order) {
        gateway.charge(order.id, order.amountMinor)
        order.status = "cancelled"
        mailer.send(order.customerEmail, "Your order ${order.id} was cancelled")
    }
}
