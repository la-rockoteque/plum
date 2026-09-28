"""Teaching artifact: the service reaches into the customer's fields to compute a discount.
When Customer's tier becomes a value type instead of a raw string, OrderService can't reuse
its existing logic on the new shape - it needs a whole new method just to read it."""

from dataclasses import dataclass
from enum import Enum


class LoyaltyTier(Enum):
    GOLD = "gold"
    SILVER = "silver"
    BRONZE = "bronze"


@dataclass
class Customer:
    tier: str
    lifetime_spend_minor: int
    years_as_member: int


@dataclass
class MigratedCustomer:
    # Same facts as Customer, after a migration - tier is now the value type, not a string.
    tier: LoyaltyTier
    lifetime_spend_minor: int
    years_as_member: int


@dataclass
class Order:
    amount_minor: int
    customer: Customer


class OrderService:
    def cancellation_fee(self, order: Order) -> int:
        # Feature envy: three of the customer's fields, read here instead of asked for.
        customer = order.customer
        if customer.tier == "gold":
            discount_bps = 2000
        elif customer.lifetime_spend_minor >= 100_000:
            discount_bps = 1000
        elif customer.years_as_member >= 2:
            discount_bps = 500
        else:
            discount_bps = 0
        return order.amount_minor * (10_000 - discount_bps) // 10_000

    def loyalty_discount(self, customer: Customer) -> int:
        # The same interpretation, read again for a receipt line.
        if customer.tier == "gold":
            return 2000
        elif customer.lifetime_spend_minor >= 100_000:
            return 1000
        elif customer.years_as_member >= 2:
            return 500
        return 0

    def migrated_loyalty_discount(self, customer: MigratedCustomer) -> int:
        # Customer's tier became a value type - OrderService gained a whole new method just
        # to read it, because the interpretation lives here, not on Customer.
        if customer.tier == LoyaltyTier.GOLD:
            return 2000
        elif customer.lifetime_spend_minor >= 100_000:
            return 1000
        elif customer.years_as_member >= 2:
            return 500
        return 0
