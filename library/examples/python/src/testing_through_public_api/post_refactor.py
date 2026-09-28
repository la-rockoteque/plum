from dataclasses import dataclass
from typing import Protocol


class Order:
    def __init__(self, order_id: str, total: float, status: str = "placed") -> None:
        self.id = order_id
        self.total = total
        self.status = status


class OrderRepository(Protocol):
    def find_by_id(self, order_id: str) -> Order: ...
    def save(self, order: Order) -> None: ...


class Notifier(Protocol):
    def send(self, message: str) -> None: ...


@dataclass
class CancellationOutcome:
    order_id: str
    refund_amount: float
    status: str


class NotificationFormatter:
    """The unit's own internal collaborator: constructed by the service, never injected."""

    def format(self, order_id: str, refund_amount: float) -> str:
        return f"Order {order_id} cancelled; refund {refund_amount:.2f}"


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
        order.status = "cancelled"

    def cancel(self, order_id: str) -> CancellationOutcome:
        order = self.orders.find_by_id(order_id)
        fee = round(order.total * self._cancellation_fee_rate, 2)  # calculate_fee() inlined here
        self._transition_status(order)
        refund = round(order.total - fee, 2)
        self.notifier.send(self._formatter.format(order_id, refund))
        self.orders.save(order)
        return CancellationOutcome(order_id, refund, order.status)
