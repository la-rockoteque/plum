from dataclasses import dataclass


@dataclass
class Order:
    id: str
    customer_name: str
    customer_email: str
    status: str = "pending"


class OrderService:
    """Cancels an order, formats the customer email, and writes the audit log —
    three reasons to change: the cancellation rule, the email wording, and the
    audit format."""

    def __init__(self) -> None:
        self.sent_emails: list[str] = []
        self.audit_log: list[str] = []

    def cancel(self, order: Order, reason: str) -> None:
        if order.status == "shipped":
            raise ValueError("cannot cancel a shipped order")
        order.status = "cancelled"
        self.sent_emails.append(
            f"Dear {order.customer_name}, your order {order.id} was cancelled. Reason: {reason}."
        )
        self.audit_log.append(f"{order.id}|CANCELLED|{reason}")
