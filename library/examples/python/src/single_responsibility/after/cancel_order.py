from typing import Protocol

from single_responsibility.after.order import Order, OrderStatus


class Notifier(Protocol):
    def notify_cancelled(self, order: Order, reason: str) -> None: ...


class Auditor(Protocol):
    def record_cancelled(self, order: Order, reason: str) -> None: ...


class CancelOrder:
    """Owns only the cancellation rule; notifying and auditing are delegated
    to ports its collaborators implement."""

    def __init__(self, notifier: Notifier, audit_log: Auditor) -> None:
        self.notifier = notifier
        self.audit_log = audit_log

    def execute(self, order: Order, reason: str) -> None:
        if order.status in (OrderStatus.SHIPPED, OrderStatus.CANCELLED):
            raise ValueError("cannot cancel a shipped or cancelled order")
        order.status = OrderStatus.CANCELLED
        self.notifier.notify_cancelled(order, reason)
        self.audit_log.record_cancelled(order, reason)
