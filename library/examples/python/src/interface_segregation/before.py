from typing import Protocol


class Order:
    def __init__(self, order_id: int, customer_email: str, amount_minor: int, status: str = "pending") -> None:
        self.id = order_id
        self.customer_email = customer_email
        self.amount_minor = amount_minor
        self.status = status


class OrderStoreV1(Protocol):
    """The only persistence contract available. CancelOrder depends on all seven
    methods below even though it only ever calls two of them."""

    def get(self, order_id: int) -> Order: ...
    def save(self, order: Order) -> None: ...
    def delete(self, order_id: int) -> None: ...
    def list_by_customer(self, customer_email: str) -> list[Order]: ...
    def export_csv(self) -> str: ...
    def audit_trail(self, order_id: int) -> list[str]: ...
    def purge_older_than(self, days: int) -> int: ...


class OrderStoreV2(OrderStoreV1, Protocol):
    """The fat interface grows an eighth method. Every implementer -- including a
    fake written for a use case that never touches archiving -- must grow with it."""

    def archive(self, order_id: int) -> None: ...


class CancelOrder:
    """Depends on the whole fat interface, though it only ever calls get and save."""

    def __init__(self, store: OrderStoreV1) -> None:
        self.store = store

    def execute(self, order_id: int) -> None:
        order = self.store.get(order_id)
        order.status = "cancelled"
        self.store.save(order)
