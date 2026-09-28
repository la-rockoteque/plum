from dataclasses import dataclass
from enum import Enum
from typing import Protocol


class OrderStatus(str, Enum):
    PENDING = "pending"
    SHIPPED = "shipped"
    CANCELLED = "cancelled"


class ChargeResult(str, Enum):
    APPROVED = "approved"
    DECLINED = "declined"


@dataclass
class Order:
    id: int
    customer_email: str
    amount_minor: int
    status: OrderStatus = OrderStatus.PENDING


class OrderRepository(Protocol):
    def get(self, order_id: int) -> Order: ...
    def save(self, order: Order) -> None: ...


class PaymentGateway(Protocol):
    def charge(self, order_id: int, amount_minor: int) -> ChargeResult: ...


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
        self.audit_logger = audit_logger

    def execute(self, order_id: int) -> None:
        order = self.orders.get(order_id)
        result = self.gateway.charge(order.id, order.amount_minor)
        if result is ChargeResult.DECLINED:
            # A declined charge is a legitimate business outcome, not a crash: the audit
            # logger is a real collaborator on this path, even though the happy path
            # never touches it.
            self.audit_logger.log(f"charge declined for order {order.id}")
            return
        order.status = OrderStatus.CANCELLED
        self.mailer.send(order.customer_email, f"Your order {order.id} was cancelled")
        self.orders.save(order)
