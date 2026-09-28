"""Callers tell the order to cancel itself; Order owns the rule, the timestamp and the refund.
Setters disappear, and the invalid transition (cancelling a shipped order) is rejected once,
inside Order, instead of missed by whichever caller forgot to check."""

from enum import Enum
from typing import Optional, Protocol


class OrderStatus(str, Enum):
    PENDING = "pending"
    SHIPPED = "shipped"
    CANCELLED = "cancelled"


class Clock(Protocol):
    def now_ms(self) -> int: ...


class Order:
    def __init__(
        self,
        id: int,
        status: OrderStatus,
        amount_paid_cents: int,
        shipped_at_ms: Optional[int] = None,
    ) -> None:
        self.id = id
        self.amount_paid_cents = amount_paid_cents
        self.shipped_at_ms = shipped_at_ms
        self._status = status
        self._cancelled_at_ms: Optional[int] = None
        self._refund_due_cents = 0

    @property
    def status(self) -> OrderStatus:
        return self._status

    @property
    def cancelled_at_ms(self) -> Optional[int]:
        return self._cancelled_at_ms

    @property
    def refund_due_cents(self) -> int:
        return self._refund_due_cents

    def cancel(self, clock: Clock) -> None:
        if self._status != OrderStatus.PENDING:
            raise ValueError(f"cannot cancel an order with status {self._status.value}")
        self._status = OrderStatus.CANCELLED
        self._cancelled_at_ms = clock.now_ms()
        self._refund_due_cents = self.amount_paid_cents


class ApiCancelHandler:
    def cancel(self, order: Order, clock: Clock) -> None:
        order.cancel(clock)


class NightlyCancelJob:
    def cancel(self, order: Order, clock: Clock) -> None:
        order.cancel(clock)


class AdminCancelTool:
    def cancel(self, order: Order, clock: Clock) -> None:
        order.cancel(clock)
