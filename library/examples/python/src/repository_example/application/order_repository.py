from typing import Protocol

from repository_example.domain.order import Order


class OrderRepository(Protocol):
    """Return detached orders; save inserts or updates an order by ID."""

    def get(self, order_id: int) -> Order | None: ...

    def save(self, order: Order) -> None: ...
