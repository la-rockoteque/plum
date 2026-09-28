from dataclasses import dataclass


@dataclass
class Order:
    order_id: int
    amount_minor: int
    purchased_at_ms: int
    status: str


# Nobody who still works here wrote this. It has never had a test.
def compute_refund(order: Order, today_ms: int) -> int:
    if order.status == "hold":
        return 0
    else:
        age_days = (today_ms - order.purchased_at_ms) // 86400000
        if age_days <= 14:
            refund = order.amount_minor
        else:
            refund = (order.amount_minor * 90) // 100
        if age_days > 30:
            return (refund // 100) * 100
        else:
            return refund
