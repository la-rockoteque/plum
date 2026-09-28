class SmtpMailer:
    """Stand-in for a real SMTP client: this library never opens a socket."""

    def send(self, to: str, message: str) -> None:
        raise RuntimeError("network unavailable")


class HttpPaymentGateway:
    """Stand-in for a real payment-gateway HTTP client."""

    def charge(self, order_id: str, amount: float) -> None:
        raise RuntimeError("network unavailable")


class Order:
    def __init__(self, order_id: str, customer_email: str, cancellation_fee: float, status: str = "placed") -> None:
        self.id = order_id
        self.customer_email = customer_email
        self.cancellation_fee = cancellation_fee
        self.status = status


class CancelOrder:
    """Self-constructs its collaborators: no test can observe anything but the crash."""

    def __init__(self) -> None:
        self.gateway = HttpPaymentGateway()
        self.mailer = SmtpMailer()

    def execute(self, order: Order) -> None:
        self.gateway.charge(order.id, order.cancellation_fee)
        order.status = "cancelled"
        self.mailer.send(order.customer_email, f"Your order {order.id} was cancelled")
