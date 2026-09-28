from single_responsibility.after.audit_log import AuditLog
from single_responsibility.after.order import Order
from single_responsibility.after.order_notifier import OrderNotifier


class CancelOrder:
    """Owns only the cancellation rule; notifying and auditing are delegated
    to its collaborators."""

    def __init__(self, notifier: OrderNotifier, audit_log: AuditLog) -> None:
        self.notifier = notifier
        self.audit_log = audit_log

    def execute(self, order: Order, reason: str) -> None:
        if order.status == "shipped":
            raise ValueError("cannot cancel a shipped order")
        order.status = "cancelled"
        self.notifier.notify_cancelled(order, reason)
        self.audit_log.record_cancelled(order, reason)
