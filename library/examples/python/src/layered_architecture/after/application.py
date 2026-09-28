from typing import Protocol

from layered_architecture.after.domain import Order


class OrderRepository(Protocol):
    """Port owned by the application layer. Data adapters implement it."""

    def get(self, order_id: int) -> Order | None: ...

    def save(self, order: Order) -> None: ...


class OrderNotFound(Exception):
    pass


class CancelOrder:
    """Application service: loads the aggregate, calls domain behaviour, saves it."""

    def __init__(self, repository: OrderRepository) -> None:
        self.repository = repository

    def execute(self, order_id: int) -> None:
        order = self.repository.get(order_id)
        if order is None:
            raise OrderNotFound(f"order {order_id} not found")
        order.cancel()
        self.repository.save(order)
