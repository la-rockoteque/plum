from dataclasses import dataclass, replace

MAX_LINES = 10


class OrderCancelledError(Exception):
    pass


class InvalidQuantityError(Exception):
    pass


class TooManyLinesError(Exception):
    pass


class LineNotFoundError(Exception):
    pass


@dataclass
class OrderLine:
    """Held only inside the aggregate; callers only ever see copies of it."""

    id: int
    sku: str
    quantity: int
    unit_price_minor: int
    currency: str


class Order:
    """The aggregate root: the only entry point for reading or changing its lines."""

    def __init__(self, id: int, currency: str = "USD") -> None:
        self.id = id
        self._status = "pending"
        self._currency = currency
        self._lines: list[OrderLine] = []
        self._next_line_id = 1

    @property
    def status(self) -> str:
        return self._status

    @property
    def lines(self) -> list[OrderLine]:
        """Returns copies: mutating the result can never change the aggregate's state."""
        return [replace(line) for line in self._lines]

    @property
    def total_minor(self) -> int:
        """Always derived from the current lines — never a cache that can go stale."""
        return sum(line.quantity * line.unit_price_minor for line in self._lines)

    def add_line(self, sku: str, quantity: int, unit_price_minor: int) -> int:
        self._guard_not_cancelled()
        self._guard_quantity(quantity)
        if len(self._lines) >= MAX_LINES:
            raise TooManyLinesError(f"an order can have at most {MAX_LINES} lines")
        line = OrderLine(
            id=self._next_line_id,
            sku=sku,
            quantity=quantity,
            unit_price_minor=unit_price_minor,
            currency=self._currency,
        )
        self._next_line_id += 1
        self._lines.append(line)
        return line.id

    def change_quantity(self, line_id: int, quantity: int) -> None:
        self._guard_not_cancelled()
        self._guard_quantity(quantity)
        index = self._index_of(line_id)
        self._lines[index].quantity = quantity

    def remove_line(self, line_id: int) -> None:
        self._guard_not_cancelled()
        index = self._index_of(line_id)
        del self._lines[index]

    def cancel(self) -> None:
        self._status = "cancelled"

    def _index_of(self, line_id: int) -> int:
        for i, line in enumerate(self._lines):
            if line.id == line_id:
                return i
        raise LineNotFoundError(f"no such line: {line_id}")

    def _guard_not_cancelled(self) -> None:
        if self._status == "cancelled":
            raise OrderCancelledError("cannot modify a cancelled order")

    def _guard_quantity(self, quantity: int) -> None:
        if quantity < 1:
            raise InvalidQuantityError("quantity must be at least 1")


class OrderRepository:
    """One repository per aggregate: it saves and loads the whole Order, not individual lines."""

    def __init__(self) -> None:
        self._orders: dict[int, Order] = {}

    def save(self, order: Order) -> None:
        self._orders[order.id] = order

    def get(self, order_id: int) -> Order | None:
        return self._orders.get(order_id)
