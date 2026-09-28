from typing import Protocol


class Order:
    def __init__(self, order_id: int, customer_email: str, amount_minor: int, status: str = "pending") -> None:
        self.id = order_id
        self.customer_email = customer_email
        self.amount_minor = amount_minor
        self.status = status


class CancelOrderStore(Protocol):
    """A role interface owned by CancelOrder: only what it needs, declared next to it."""

    def get(self, order_id: int) -> Order: ...
    def save(self, order: Order) -> None: ...


class OrderArchiver(Protocol):
    """A separate role interface for a different client. CancelOrder never sees it."""

    def archive(self, order_id: int) -> None: ...


class CancelOrder:
    def __init__(self, store: CancelOrderStore) -> None:
        self.store = store

    def execute(self, order_id: int) -> None:
        order = self.store.get(order_id)
        order.status = "cancelled"
        self.store.save(order)


class OrderStoreAdapter:
    """The concrete adapter implements several role interfaces at once; CancelOrder
    only ever depends on the narrow one (CancelOrderStore)."""

    def __init__(self) -> None:
        self._orders: dict[int, Order] = {}

    def get(self, order_id: int) -> Order:
        return self._orders[order_id]

    def save(self, order: Order) -> None:
        self._orders[order.id] = order

    def archive(self, order_id: int) -> None:
        self._orders[order_id].status = "archived"
