from single_responsibility.after.order import Order


class OrderNotifier:
    """Owns the wording of the cancellation email — its only reason to change."""

    def __init__(self) -> None:
        self.sent: list[str] = []

    def notify_cancelled(self, order: Order, reason: str) -> None:
        self.sent.append(
            f"Dear {order.customer_name}, your order {order.id} was cancelled. Reason: {reason}."
        )
