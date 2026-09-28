from dataclasses import dataclass
from enum import Enum


class InvalidStatusTransition(Exception):
    pass


class UnknownStatus(Exception):
    pass


class OrderStatus(Enum):
    """A value object: only these states exist, and only some moves between them are legal."""

    PENDING = "pending"
    SHIPPED = "shipped"
    CANCELLED = "cancelled"

    @classmethod
    def parse(cls, value: str) -> "OrderStatus":
        try:
            return cls(value)
        except ValueError:
            raise UnknownStatus(f"Unknown order status: {value!r}") from None

    def transition_to(self, target: "OrderStatus") -> "OrderStatus":
        if self is OrderStatus.PENDING and target in (OrderStatus.SHIPPED, OrderStatus.CANCELLED):
            return target
        raise InvalidStatusTransition(f"Cannot move from {self.value} to {target.value}")


class CurrencyMismatch(Exception):
    pass


@dataclass(frozen=True)
class Money:
    """A value object: immutable, compared by value, and blind to arithmetic across currencies."""

    amount_minor: int
    currency: str

    def add(self, other: "Money") -> "Money":
        if other.currency != self.currency:
            raise CurrencyMismatch(f"Cannot add {other.currency} to {self.currency}")
        return Money(self.amount_minor + other.amount_minor, self.currency)


class Order:
    """An entity: two Orders are the same order iff they share an id, whatever their attributes."""

    def __init__(self, id: int, status: OrderStatus, total: Money) -> None:
        self.id = id
        self._status = status
        self.total = total

    @property
    def status(self) -> OrderStatus:
        """Read-only: the only way to change status is through ship()/cancel(), which enforce
        legal transitions. There is no setter, so a caller can't reach back in and reset it."""
        return self._status

    def ship(self) -> None:
        self._status = self._status.transition_to(OrderStatus.SHIPPED)

    def cancel(self) -> None:
        self._status = self._status.transition_to(OrderStatus.CANCELLED)

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, Order):
            return NotImplemented
        return self.id == other.id

    def __hash__(self) -> int:
        return hash(self.id)
