"""One switch on order.type decides the fee — and it isn't the only one
(see refund_description.py)."""
from open_closed.before.order import (
    CUSTOM_MADE,
    CUSTOM_MADE_FEE_RATE,
    EXPRESS,
    EXPRESS_FLAT_FEE,
    Order,
    STANDARD,
    SUBSCRIPTION,
)


class CancellationFeeCalculator:
    def calculate_fee(self, order: Order) -> float:
        if order.type == STANDARD:
            return 0.0 if order.pending else order.amount
        if order.type == EXPRESS:
            return EXPRESS_FLAT_FEE
        if order.type == CUSTOM_MADE:
            return order.amount * CUSTOM_MADE_FEE_RATE
        if order.type == SUBSCRIPTION:
            return order.amount * order.months_elapsed / order.total_months
        raise ValueError(f"unhandled order type: {order.type}")
