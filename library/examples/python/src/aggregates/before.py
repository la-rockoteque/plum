from dataclasses import dataclass


@dataclass
class OrderLine:
    """A line entity with its own identity — nothing stops a caller reaching it directly."""

    id: int
    order_id: int
    sku: str
    quantity: int
    unit_price_minor: int
    currency: str


class OrderLineRepository:
    """Lines get their own repository/collection, so callers can bypass the order entirely."""

    def __init__(self) -> None:
        self._lines: dict[int, OrderLine] = {}

    def add(self, line: OrderLine) -> None:
        self._lines[line.id] = line

    def update_quantity(self, line_id: int, quantity: int) -> None:
        self._lines[line_id].quantity = quantity

    def remove(self, line_id: int) -> None:
        del self._lines[line_id]

    def for_order(self, order_id: int) -> list[OrderLine]:
        return [line for line in self._lines.values() if line.order_id == order_id]


@dataclass
class Order:
    """total_minor is a cache: correct only if every caller remembers to refresh it."""

    id: int
    status: str = "pending"
    total_minor: int = 0
    currency: str = "USD"


def recompute_total(order: Order, lines: list[OrderLine]) -> None:
    """Refreshes the cached total from the current lines — easy to forget to call."""
    order.total_minor = sum(line.quantity * line.unit_price_minor for line in lines)
