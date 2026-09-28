"""The same switch, copy-pasted here for the customer-facing message — kept in
sync for express and subscription, never updated when custom-made orders were
added."""
from open_closed.before.order import EXPRESS, Order, STANDARD, SUBSCRIPTION


class RefundDescription:
    def describe(self, order: Order) -> str:
        if order.type == STANDARD:
            return "Full refund, order not yet processed" if order.pending else "No refund, order already shipped"
        if order.type == EXPRESS:
            return "Refund minus a flat express handling fee"
        if order.type == SUBSCRIPTION:
            return "Prorated refund for unused months"
        return "Refund processed"
