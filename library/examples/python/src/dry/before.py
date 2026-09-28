"""before: the cancellation-eligibility rule is copy-pasted into a CLI and an API handler."""
from dataclasses import dataclass
from enum import Enum
from typing import Protocol

CANCELLATION_WINDOW_MS = 24 * 60 * 60 * 1000


class OrderStatus(str, Enum):
    PENDING = "pending"
    SHIPPED = "shipped"
    CANCELLED = "cancelled"


@dataclass
class Order:
    id: int
    status: OrderStatus
    placed_at_ms: int


class Clock(Protocol):
    def now_ms(self) -> int: ...


class CliCancelHandler:
    """Got the window check in a later bug fix."""

    def can_cancel(self, order: Order, clock: Clock) -> bool:
        if order.status != OrderStatus.PENDING:
            return False
        return clock.now_ms() - order.placed_at_ms <= CANCELLATION_WINDOW_MS


class ApiCancelHandler:
    """Copy-pasted from the CLI handler before the window check was added."""

    def can_cancel(self, order: Order, clock: Clock) -> bool:
        return order.status == OrderStatus.PENDING
