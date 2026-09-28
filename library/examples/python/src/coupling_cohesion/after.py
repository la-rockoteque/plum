"""Customer answers its own question - what loyalty discount do I get? OrderService only asks,
through a structural type, so it never cares which representation of Customer answers."""

from dataclasses import dataclass
from enum import Enum
from typing import Protocol


class LoyaltyTier(Enum):
    GOLD = "gold"
    SILVER = "silver"
    BRONZE = "bronze"


class DiscountEligible(Protocol):
    def loyalty_discount(self) -> int: ...


@dataclass
class Customer:
    tier: str
    lifetime_spend_minor: int
    years_as_member: int

    # The one place that knows how tier, spend and membership translate into a discount.
    def loyalty_discount(self) -> int:
        if self.tier == "gold":
            return 2000
        elif self.lifetime_spend_minor >= 100_000:
            return 1000
        elif self.years_as_member >= 2:
            return 500
        return 0


@dataclass
class MigratedCustomer:
    # Same question, a different internal shape - tier is the value type, not a string.
    tier: LoyaltyTier
    lifetime_spend_minor: int
    years_as_member: int

    def loyalty_discount(self) -> int:
        if self.tier == LoyaltyTier.GOLD:
            return 2000
        elif self.lifetime_spend_minor >= 100_000:
            return 1000
        elif self.years_as_member >= 2:
            return 500
        return 0


@dataclass
class Order:
    amount_minor: int
    customer: DiscountEligible


class OrderService:
    def cancellation_fee(self, order: Order) -> int:
        discount_bps = order.customer.loyalty_discount()
        return order.amount_minor * (10_000 - discount_bps) // 10_000

    def loyalty_discount(self, customer: DiscountEligible) -> int:
        return customer.loyalty_discount()
