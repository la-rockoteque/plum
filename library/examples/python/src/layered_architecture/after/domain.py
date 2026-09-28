from dataclasses import dataclass
from enum import Enum


class OrderStatus(str, Enum):
    PENDING = "pending"
    SHIPPED = "shipped"
    CANCELLED = "cancelled"


class OrderCannotBeCancelled(Exception):
    pass


@dataclass
class Order:
    id: int
    status: OrderStatus = OrderStatus.PENDING

    def cancel(self) -> None:
        if self.status in (OrderStatus.SHIPPED, OrderStatus.CANCELLED):
            raise OrderCannotBeCancelled(f"order {self.id} already {self.status.value}")
        self.status = OrderStatus.CANCELLED
