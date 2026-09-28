from dataclasses import dataclass
from enum import Enum


class OrderStatus(str, Enum):
    PENDING = "pending"
    CANCELLED = "cancelled"


class OrderAlreadyCancelled(Exception):
    pass


@dataclass
class Order:
    id: int
    status: OrderStatus = OrderStatus.PENDING

    def cancel(self) -> None:
        if self.status == OrderStatus.CANCELLED:
            raise OrderAlreadyCancelled(f"Order {self.id} already cancelled")
        self.status = OrderStatus.CANCELLED
