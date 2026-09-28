from dataclasses import dataclass
from typing import Protocol

from repository_example.application.cancel_order import OrderNotFound


@dataclass(frozen=True)
class OrderSummary:
    id: int
    status: str
    can_cancel: bool


class OrderSummaryReader(Protocol):
    def get_summary(self, order_id: int) -> OrderSummary | None: ...


class GetOrderSummary:
    def __init__(self, reader: OrderSummaryReader) -> None:
        self.reader = reader

    def execute(self, order_id: int) -> OrderSummary:
        summary = self.reader.get_summary(order_id)
        if summary is None:
            raise OrderNotFound(f"Order {order_id} not found")
        return summary
