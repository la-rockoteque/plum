"""after: the rule lives once, on the order; both handlers call it."""
from dataclasses import dataclass
from enum import Enum
from typing import Protocol

CANCELLATION_WINDOW_MS = 24 * 60 * 60 * 1000


class OrderStatus(str, Enum):
    PENDING = "pending"
    SHIPPED = "shipped"
    CANCELLED = "cancelled"


class Clock(Protocol):
    def now_ms(self) -> int: ...


@dataclass
class Order:
    id: int
    status: OrderStatus
    placed_at_ms: int

    def can_be_cancelled(self, clock: Clock) -> bool:
        if self.status != OrderStatus.PENDING:
            return False
        return clock.now_ms() - self.placed_at_ms <= CANCELLATION_WINDOW_MS


class CliCancelHandler:
    def can_cancel(self, order: Order, clock: Clock) -> bool:
        return order.can_be_cancelled(clock)


class ApiCancelHandler:
    def can_cancel(self, order: Order, clock: Clock) -> bool:
        return order.can_be_cancelled(clock)
