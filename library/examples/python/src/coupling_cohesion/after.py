"""The customer owns the question "what discount do I get?"; the service only asks it."""

from dataclasses import dataclass


@dataclass
class Customer:
    tier: str
    lifetime_spend: float
    years_as_member: int

    def cancellation_discount(self) -> float:
        # The one place that knows how tier, spend and membership translate into a discount.
        if self.tier == "gold":
            return 0.25
        elif self.lifetime_spend >= 1000:
            return 0.125
        elif self.years_as_member >= 2:
            return 0.0625
        else:
            return 0.0


@dataclass
class Order:
    amount: float
    customer: Customer


class OrderService:
    def cancellation_fee(self, order: Order) -> float:
        return order.amount * (1 - order.customer.cancellation_discount())

    def loyalty_discount(self, customer: Customer) -> float:
        return customer.cancellation_discount()
