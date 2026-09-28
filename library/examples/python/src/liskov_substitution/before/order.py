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
    status: OrderStatus = OrderStatus.PENDING

    def cancel(self, reason: str) -> None:
        if self.status in (OrderStatus.SHIPPED, OrderStatus.CANCELLED):
            raise ValueError("cannot cancel a shipped or cancelled order")
        self.status = OrderStatus.CANCELLED


@dataclass
class GiftOrder(Order):
    """Strengthens Order's precondition: cancel() rejects every request, even
    while pending, where the base class would accept it. A caller that only
    knows the Order contract can no longer assume cancelling a pending order
    succeeds."""

    def cancel(self, reason: str) -> None:
        raise ValueError("gift orders can't be cancelled online")
