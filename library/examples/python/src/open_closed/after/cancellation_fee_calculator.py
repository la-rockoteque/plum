"""Chooses the policy once, by order type; a new type means adding to the map
passed in here, never a new branch in this class."""
from open_closed.after.fee_policy import DEFAULT_POLICIES, FeePolicy
from open_closed.after.order import Order


class CancellationFeeCalculator:
    def __init__(self, policies: dict[str, FeePolicy] = DEFAULT_POLICIES) -> None:
        self._policies = policies

    def calculate_fee(self, order: Order) -> float:
        return self._policies[order.type].fee(order)

    def describe_refund(self, order: Order) -> str:
        return self._policies[order.type].describe_refund(order)
