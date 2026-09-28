from dataclasses import dataclass
from enum import Enum


class OrderStatus(str, Enum):
    PENDING = "pending"
    SHIPPED = "shipped"
    CANCELLED = "cancelled"


@dataclass
class Order:
    id: int
    customer_name: str
    customer_email: str
    status: OrderStatus = OrderStatus.PENDING


class OrderService:
    """Cancels an order, formats the customer email, and writes the audit log —
    three reasons to change: the cancellation rule, the email wording, and the
    audit format."""

    def __init__(self) -> None:
        self.sent_emails: list[str] = []
        self.audit_log: list[str] = []

    def cancel(self, order: Order, reason: str) -> None:
        if order.status in (OrderStatus.SHIPPED, OrderStatus.CANCELLED):
            raise ValueError("cannot cancel a shipped or cancelled order")
        order.status = OrderStatus.CANCELLED
        self.sent_emails.append(
            f"Dear {order.customer_name}, your order {order.id} was cancelled. Reason: {reason}."
        )
        self.audit_log.append(f"{order.id}|CANCELLED|{reason}")
