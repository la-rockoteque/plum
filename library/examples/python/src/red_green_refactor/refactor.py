from enum import Enum


class OrderStatus(str, Enum):
    PENDING = "pending"
    SHIPPED = "shipped"
    CANCELLED = "cancelled"


# The rule, named and in one place instead of a string compare buried in cancel().
NON_CANCELLABLE_STATUSES = frozenset({OrderStatus.SHIPPED})


class Order:
    def __init__(self, status: OrderStatus = OrderStatus.PENDING) -> None:
        self.status = status

    def can_cancel(self) -> bool:
        return self.status not in NON_CANCELLABLE_STATUSES

    def cancel(self) -> None:
        if not self.can_cancel():
            raise ValueError("a shipped order can't be cancelled")
        self.status = OrderStatus.CANCELLED
