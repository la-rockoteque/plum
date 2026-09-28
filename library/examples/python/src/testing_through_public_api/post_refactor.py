from dataclasses import dataclass
from enum import Enum
from typing import Protocol


class OrderStatus(str, Enum):
    PENDING = "pending"
    SHIPPED = "shipped"
    CANCELLED = "cancelled"


@dataclass
class Order:
    id: int
    amount_minor: int
    status: OrderStatus = OrderStatus.PENDING


class OrderRepository(Protocol):
    def find_by_id(self, order_id: int) -> Order: ...
    def save(self, order: Order) -> None: ...


class Notifier(Protocol):
    def send(self, message: str) -> None: ...


@dataclass
class CancellationOutcome:
    order_id: int
    refund_amount_minor: int
    status: OrderStatus


class NotificationFormatter:
    """The unit's own internal collaborator: constructed by the service, never injected."""

    def format(self, order_id: int, refund_amount_minor: int) -> str:
        return f"Order {order_id} cancelled; refund {refund_amount_minor}"


class PostRefactorService:
    """After a behaviour-preserving refactor: the fee helper is inlined and the rate field renamed.

    A caller of cancel() cannot tell this apart from PreRefactorService - same inputs, same outcome,
    same stored state, same notification. Only the private shape changed.
    """

    def __init__(self, orders: OrderRepository, notifier: Notifier) -> None:
        self.orders = orders
        self.notifier = notifier
        self._cancellation_fee_rate = 0.1
        self._formatter = NotificationFormatter()

    def _transition_status(self, order: Order) -> None:
        order.status = OrderStatus.CANCELLED

    def cancel(self, order_id: int) -> CancellationOutcome:
        order = self.orders.find_by_id(order_id)
        fee = round(order.amount_minor * self._cancellation_fee_rate)  # calculate_fee() inlined here
        self._transition_status(order)
        refund = order.amount_minor - fee
        self.notifier.send(self._formatter.format(order_id, refund))
        self.orders.save(order)
        return CancellationOutcome(order_id, refund, order.status)
