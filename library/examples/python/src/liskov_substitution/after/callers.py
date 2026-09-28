from liskov_substitution.after.order import CancellableOrder


class CancelExpiredOrders:
    """Depends only on CancellableOrder, so it works for every subtype that
    implements it — no isinstance check, and no way to hand it a GiftOrder
    by mistake."""

    def execute(self, orders: list[CancellableOrder], reason: str) -> list[int]:
        cancelled: list[int] = []
        for order in orders:
            order.cancel(reason)
            cancelled.append(order.id)
        return cancelled


class CustomerServiceCancelTool:
    """Same capability, same absence of type checks."""

    def cancel(self, order: CancellableOrder, reason: str) -> str:
        order.cancel(reason)
        return f"order {order.id} cancelled: {reason}"
