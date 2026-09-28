from dataclasses import dataclass

MS_PER_DAY = 24 * 60 * 60 * 1000
FULL_REFUND_WINDOW_DAYS = 14
LATE_REFUND_PERCENT = 90
STALE_ORDER_THRESHOLD_DAYS = 30
STALE_REFUND_ROUNDING_UNIT_MINOR = 100


@dataclass
class Order:
    order_id: int
    amount_minor: int
    purchased_at_ms: int
    status: str


def _age_in_days(order: Order, today_ms: int) -> int:
    return (today_ms - order.purchased_at_ms) // MS_PER_DAY


def _base_refund_minor(order: Order, age_days: int) -> int:
    if age_days <= FULL_REFUND_WINDOW_DAYS:
        return order.amount_minor
    return (order.amount_minor * LATE_REFUND_PERCENT) // 100


def _round_down_if_stale(refund_minor: int, age_days: int) -> int:
    if age_days > STALE_ORDER_THRESHOLD_DAYS:
        return (refund_minor // STALE_REFUND_ROUNDING_UNIT_MINOR) * STALE_REFUND_ROUNDING_UNIT_MINOR
    return refund_minor


# Same behaviour as legacy.compute_refund, including its odd cases - named and pinned by the
# characterization tests below rather than "fixed" in passing.
def compute_refund(order: Order, today_ms: int) -> int:
    if order.status == "hold":
        return 0
    age_days = _age_in_days(order, today_ms)
    refund = _base_refund_minor(order, age_days)
    return _round_down_if_stale(refund, age_days)
