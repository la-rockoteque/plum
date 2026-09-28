from dataclasses import dataclass
from enum import Enum
from typing import Protocol, runtime_checkable


class OrderStatus(str, Enum):
    PENDING = "pending"
    SHIPPED = "shipped"
    CANCELLED = "cancelled"


@runtime_checkable
class CancellableOrder(Protocol):
    """The capability a caller actually needs: only order types that can
    honour it (pending -> cancelled, shipped/cancelled -> rejected) implement
    it. Order itself carries no cancel() — cancellation is opt-in."""

    id: int
    status: OrderStatus

    def cancel(self, reason: str) -> None: ...


@dataclass
class StandardOrder:
    id: int
    customer_name: str
    status: OrderStatus = OrderStatus.PENDING

    def cancel(self, reason: str) -> None:
        if self.status in (OrderStatus.SHIPPED, OrderStatus.CANCELLED):
            raise ValueError("cannot cancel a shipped or cancelled order")
        self.status = OrderStatus.CANCELLED


@dataclass
class SubscriptionOrder(StandardOrder):
    """A second, independent type that satisfies CancellableOrder the same
    way StandardOrder does — proving the contract, not a single class, is
    what callers depend on."""


@dataclass
class GiftOrder:
    """Shares Order's shape (id, customer_name, status) but has no cancel()
    method: it does not implement CancellableOrder at all. The domain still
    considers it an order; the type system no longer lets it reach cancel()."""

    id: int
    customer_name: str
    status: OrderStatus = OrderStatus.PENDING
