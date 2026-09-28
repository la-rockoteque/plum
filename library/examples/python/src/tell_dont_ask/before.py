"""Teaching artifact: three callers each ask Order for its state, decide in their own if, and
set the fields back. The API handler gets it right; the nightly job forgets the refund; the
admin tool never checks whether the order already shipped."""

from dataclasses import dataclass
from enum import Enum
from typing import Optional, Protocol


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
    amount_paid_cents: int
    shipped_at_ms: Optional[int] = None
    cancelled_at_ms: Optional[int] = None
    refund_due_cents: int = 0


class ApiCancelHandler:
    """The customer-facing cancel endpoint. Gets the rule right."""

    def cancel(self, order: Order, clock: Clock) -> None:
        if order.status != OrderStatus.PENDING:
            return
        order.status = OrderStatus.CANCELLED
        order.cancelled_at_ms = clock.now_ms()
        order.refund_due_cents = order.amount_paid_cents


class NightlyCancelJob:
    """Auto-cancels stale pending orders. Forgot to carry the refund forward."""

    def cancel(self, order: Order, clock: Clock) -> None:
        if order.status != OrderStatus.PENDING:
            return
        order.status = OrderStatus.CANCELLED
        order.cancelled_at_ms = clock.now_ms()
        # Bug: refund_due_cents is never set, even though the customer paid.


class AdminCancelTool:
    """Lets support force-cancel an order by id. Never checks the current status first."""

    def cancel(self, order: Order, clock: Clock) -> None:
        # Bug: no status check, so a shipped order can be "cancelled" too.
        order.status = OrderStatus.CANCELLED
        order.cancelled_at_ms = clock.now_ms()
        order.refund_due_cents = order.amount_paid_cents
