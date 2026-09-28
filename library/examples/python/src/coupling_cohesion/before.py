"""Teaching artifact: the service reaches into the customer's fields to compute a discount,
and the rule gets duplicated (and drifts) because nothing owns it but the service."""

from dataclasses import dataclass


@dataclass
class Customer:
    tier: str
    lifetime_spend: float
    years_as_member: int


@dataclass
class Order:
    amount: float
    customer: Customer


class OrderService:
    def cancellation_fee(self, order: Order) -> float:
        # Feature envy: three of the customer's fields, read here instead of asked for.
        customer = order.customer
        if customer.tier == "gold":
            discount = 0.25
        elif customer.lifetime_spend >= 1000:
            discount = 0.125
        elif customer.years_as_member >= 2:
            discount = 0.0625
        else:
            discount = 0.0
        return order.amount * (1 - discount)

    def loyalty_discount(self, customer: Customer) -> float:
        # The same rule, copied for a receipt line — and it has drifted (`>` vs `>=`).
        if customer.tier == "gold":
            return 0.25
        elif customer.lifetime_spend > 1000:
            return 0.125
        elif customer.years_as_member >= 2:
            return 0.0625
        else:
            return 0.0
