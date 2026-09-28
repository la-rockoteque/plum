from liskov_substitution.before.order import GiftOrder, Order


class CancelExpiredOrders:
    """Batch job written against the Order contract. Because GiftOrder
    strengthens that contract's precondition, this caller has to know about
    GiftOrder by name to avoid the broken cancellation."""

    def execute(self, orders: list[Order], reason: str) -> tuple[list[int], list[int]]:
        cancelled: list[int] = []
        skipped: list[int] = []
        for order in orders:
            if isinstance(order, GiftOrder):
                skipped.append(order.id)
                continue
            order.cancel(reason)
            cancelled.append(order.id)
        return cancelled, skipped


class CustomerServiceCancelTool:
    """A second caller against the same Order contract, forced to grow the
    same type check as CancelExpiredOrders — the change cost of the
    violation is paid twice."""

    def cancel(self, order: Order, reason: str) -> str:
        if isinstance(order, GiftOrder):
            return f"order {order.id} must be cancelled by phone: gift orders can't be cancelled online"
        order.cancel(reason)
        return f"order {order.id} cancelled: {reason}"
