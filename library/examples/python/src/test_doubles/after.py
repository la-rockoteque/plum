from typing import Protocol


class Order:
    def __init__(self, order_id: str, customer_email: str, cancellation_fee: float, status: str = "placed") -> None:
        self.id = order_id
        self.customer_email = customer_email
        self.cancellation_fee = cancellation_fee
        self.status = status


class OrderRepository(Protocol):
    def find_by_id(self, order_id: str) -> Order: ...
    def save(self, order: Order) -> None: ...


class PaymentGateway(Protocol):
    def charge(self, order_id: str, amount: float) -> None: ...


class Mailer(Protocol):
    def send(self, to: str, message: str) -> None: ...


class AuditLogger(Protocol):
    def log(self, message: str) -> None: ...


class CancelOrder:
    """Every collaborator is a port; the composition root decides which double or adapter plugs in."""

    def __init__(self, orders: OrderRepository, gateway: PaymentGateway, mailer: Mailer, audit_logger: AuditLogger) -> None:
        self.orders = orders
        self.gateway = gateway
        self.mailer = mailer
        self.audit_logger = audit_logger  # never called here: a dummy satisfies this parameter in tests

    def execute(self, order_id: str) -> None:
        order = self.orders.find_by_id(order_id)
        self.gateway.charge(order.id, order.cancellation_fee)
        order.status = "cancelled"
        self.mailer.send(order.customer_email, f"Your order {order.id} was cancelled")
        self.orders.save(order)
