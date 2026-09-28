from dataclasses import dataclass, replace
from enum import Enum

MAX_LINES = 10


class OrderStatus(Enum):
    PENDING = "pending"
    SHIPPED = "shipped"
    CANCELLED = "cancelled"


class OrderCancelledError(Exception):
    pass


class InvalidQuantityError(Exception):
    pass


class TooManyLinesError(Exception):
    pass


class LineNotFoundError(Exception):
    pass


class CurrencyMismatchError(Exception):
    pass


@dataclass
class OrderLine:
    id: int
    sku: str
    quantity: int
    unit_price_minor: int


class Order:
    """The aggregate root: the only entry point for reading or changing its lines."""

    def __init__(self, id: int, currency: str = "USD", status: OrderStatus = OrderStatus.PENDING) -> None:
        self.id = id
        self._status = status
        self._currency = currency
        self._lines: list[OrderLine] = []
        self._next_line_id = 1

    @property
    def status(self) -> OrderStatus:
        return self._status

    @property
    def lines(self) -> list[OrderLine]:
        """Returns copies: mutating the result can never change the aggregate's state."""
        return [replace(line) for line in self._lines]

    @property
    def total_minor(self) -> int:
        """Always derived from the current lines — never a cache that can go stale."""
        return sum(line.quantity * line.unit_price_minor for line in self._lines)

    def add_line(self, sku: str, quantity: int, unit_price_minor: int, currency: str) -> int:
        self._guard(quantity)
        if currency != self._currency:
            raise CurrencyMismatchError(f"line currency {currency} does not match order currency {self._currency}")
        if len(self._lines) >= MAX_LINES:
            raise TooManyLinesError(f"an order can have at most {MAX_LINES} lines")
        line = OrderLine(self._next_line_id, sku, quantity, unit_price_minor)
        self._next_line_id += 1
        self._lines.append(line)
        return line.id

    def change_quantity(self, line_id: int, quantity: int) -> None:
        self._guard(quantity)
        line = next((candidate for candidate in self._lines if candidate.id == line_id), None)
        if line is None:
            raise LineNotFoundError(f"no such line: {line_id}")
        line.quantity = quantity

    def cancel(self) -> None:
        """Enforces the aggregate's own invariant: a shipped or already-cancelled order can't be cancelled."""
        if self._status is not OrderStatus.PENDING:
            raise OrderCancelledError("cannot cancel a shipped or already-cancelled order")
        self._status = OrderStatus.CANCELLED

    def copy(self) -> "Order":
        """Detached copy: used by the repository so a stored order is never a live reference."""
        clone = Order(self.id, self._currency, self._status)
        clone._lines = self.lines
        clone._next_line_id = self._next_line_id
        return clone

    def _guard(self, quantity: int) -> None:
        if self._status == OrderStatus.CANCELLED:
            raise OrderCancelledError("cannot modify a cancelled order")
        if quantity < 1:
            raise InvalidQuantityError("quantity must be at least 1")


class OrderRepository:
    """One repository per aggregate: it saves and loads the whole Order, not individual lines."""

    def __init__(self) -> None:
        self._orders: dict[int, Order] = {}

    def save(self, order: Order) -> None:
        self._orders[order.id] = order.copy()

    def get(self, order_id: int) -> Order | None:
        order = self._orders.get(order_id)
        return order.copy() if order is not None else None
