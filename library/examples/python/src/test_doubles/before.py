class SmtpMailer:
    """Stand-in for a real SMTP client: this library never opens a socket."""

    def send(self, to: str, message: str) -> None:
        raise RuntimeError("network unavailable")


class HttpPaymentGateway:
    """Stand-in for a real payment-gateway HTTP client."""

    def charge(self, order_id: int, amount_minor: int) -> None:
        raise RuntimeError("network unavailable")


class Order:
    def __init__(self, order_id: int, customer_email: str, amount_minor: int, status: str = "pending") -> None:
        self.id = order_id
        self.customer_email = customer_email
        self.amount_minor = amount_minor
        self.status = status


class CancelOrder:
    """Self-constructs its collaborators: no test can observe anything but the crash."""

    def __init__(self) -> None:
        self.gateway = HttpPaymentGateway()
        self.mailer = SmtpMailer()

    def execute(self, order: Order) -> None:
        self.gateway.charge(order.id, order.amount_minor)
        order.status = "cancelled"
        self.mailer.send(order.customer_email, f"Your order {order.id} was cancelled")
