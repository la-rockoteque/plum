from dataclasses import dataclass


@dataclass
class Order:
    """An order built from bare primitives: status and money carry no rules of their own."""

    id: int
    status: str = "pending"
    total: float = 0.0
    currency: str = "USD"


def add_totals(a: Order, b: Order) -> float:
    """Adds two orders' totals. Nothing here notices the currencies might differ."""
    return a.total + b.total
