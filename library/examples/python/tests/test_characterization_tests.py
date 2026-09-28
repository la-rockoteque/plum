from characterization_tests.legacy import Order as LegacyOrder
from characterization_tests.legacy import compute_refund as legacy_compute_refund
from characterization_tests.refactored import Order as RefactoredOrder
from characterization_tests.refactored import compute_refund as refactored_compute_refund

MS_PER_DAY = 24 * 60 * 60 * 1000
TODAY_MS = 1_700_000_000_000


def test_before_nobody_knows_what_compute_refund_does_for_most_inputs() -> None:
    # The starting point of legacy work: one sample input pinned, nothing more understood yet.
    order = LegacyOrder(order_id=1, amount_minor=10_000, purchased_at_ms=TODAY_MS - 5 * MS_PER_DAY, status="active")
    assert legacy_compute_refund(order, TODAY_MS) == 10_000


def test_currently_a_hold_order_refunds_zero_regardless_of_age() -> None:
    fields = dict(order_id=2, amount_minor=10_000, purchased_at_ms=TODAY_MS - 5 * MS_PER_DAY, status="hold")
    assert legacy_compute_refund(LegacyOrder(**fields), TODAY_MS) == 0
    assert refactored_compute_refund(RefactoredOrder(**fields), TODAY_MS) == 0


def test_currently_an_order_exactly_14_days_old_gets_a_full_refund() -> None:
    fields = dict(order_id=3, amount_minor=10_000, purchased_at_ms=TODAY_MS - 14 * MS_PER_DAY, status="active")
    assert legacy_compute_refund(LegacyOrder(**fields), TODAY_MS) == 10_000
    assert refactored_compute_refund(RefactoredOrder(**fields), TODAY_MS) == 10_000


def test_currently_an_order_15_days_old_refunds_90_percent() -> None:
    fields = dict(order_id=4, amount_minor=10_000, purchased_at_ms=TODAY_MS - 15 * MS_PER_DAY, status="active")
    assert legacy_compute_refund(LegacyOrder(**fields), TODAY_MS) == 9_000
    assert refactored_compute_refund(RefactoredOrder(**fields), TODAY_MS) == 9_000


def test_currently_an_order_exactly_30_days_old_is_not_rounded_down() -> None:
    fields = dict(order_id=5, amount_minor=10_050, purchased_at_ms=TODAY_MS - 30 * MS_PER_DAY, status="active")
    assert legacy_compute_refund(LegacyOrder(**fields), TODAY_MS) == 9_045
    assert refactored_compute_refund(RefactoredOrder(**fields), TODAY_MS) == 9_045


def test_currently_an_order_older_than_30_days_rounds_the_refund_down_to_the_nearest_hundred() -> None:
    fields = dict(order_id=6, amount_minor=10_050, purchased_at_ms=TODAY_MS - 31 * MS_PER_DAY, status="active")
    assert legacy_compute_refund(LegacyOrder(**fields), TODAY_MS) == 9_000
    assert refactored_compute_refund(RefactoredOrder(**fields), TODAY_MS) == 9_000
