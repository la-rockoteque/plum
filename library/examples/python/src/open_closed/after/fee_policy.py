"""One policy per order type: each owns both its fee and its refund
description, so the two concerns can never fall out of sync again."""
from typing import Protocol

from open_closed.after.order import CUSTOM_MADE, EXPRESS, Order, STANDARD, SUBSCRIPTION

EXPRESS_FLAT_FEE = 15.0
CUSTOM_MADE_FEE_RATE = 0.5


class FeePolicy(Protocol):
    def fee(self, order: Order) -> float: ...
    def describe_refund(self, order: Order) -> str: ...


class StandardFeePolicy:
    def fee(self, order: Order) -> float:
        return 0.0 if order.pending else order.amount

    def describe_refund(self, order: Order) -> str:
        return "Full refund, order not yet processed" if order.pending else "No refund, order already shipped"


class ExpressFeePolicy:
    def fee(self, order: Order) -> float:
        return EXPRESS_FLAT_FEE

    def describe_refund(self, order: Order) -> str:
        return "Refund minus a flat express handling fee"


class CustomMadeFeePolicy:
    def fee(self, order: Order) -> float:
        return order.amount * CUSTOM_MADE_FEE_RATE

    def describe_refund(self, order: Order) -> str:
        return "50% refund, materials already committed"


class SubscriptionFeePolicy:
    def fee(self, order: Order) -> float:
        return order.amount * order.months_elapsed / order.total_months

    def describe_refund(self, order: Order) -> str:
        return "Prorated refund for unused months"


DEFAULT_POLICIES: dict[str, FeePolicy] = {
    STANDARD: StandardFeePolicy(),
    EXPRESS: ExpressFeePolicy(),
    CUSTOM_MADE: CustomMadeFeePolicy(),
    SUBSCRIPTION: SubscriptionFeePolicy(),
}
