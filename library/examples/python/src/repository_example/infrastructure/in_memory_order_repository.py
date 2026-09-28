from dataclasses import replace

from repository_example.domain.order import Order


class InMemoryOrderRepository:
    def __init__(self) -> None:
        self.orders: dict[int, Order] = {}

    def get(self, order_id: int) -> Order | None:
        order = self.orders.get(order_id)
        return replace(order) if order is not None else None

    def save(self, order: Order) -> None:
        self.orders[order.id] = replace(order)
