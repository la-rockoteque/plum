"""before: switch (order.type) duplicated across the fee calculator and the
refund description → after: one FeePolicy per type, chosen once through a map."""
from open_closed.after.cancellation_fee_calculator import CancellationFeeCalculator as AfterCalculator
from open_closed.after.fee_policy import DEFAULT_POLICIES, FeePolicy
from open_closed.after.order import CUSTOM_MADE as AFTER_CUSTOM_MADE
from open_closed.after.order import EXPRESS as AFTER_EXPRESS
from open_closed.after.order import Order as AfterOrder
from open_closed.after.order import STANDARD as AFTER_STANDARD
from open_closed.after.order import SUBSCRIPTION as AFTER_SUBSCRIPTION
from open_closed.before.fee_calculator import CancellationFeeCalculator as BeforeCalculator
from open_closed.before.order import CUSTOM_MADE, EXPRESS, Order as BeforeOrder, STANDARD, SUBSCRIPTION
from open_closed.before.refund_description import RefundDescription


def test_before_fee_for_a_pending_standard_order_is_free() -> None:
    order = BeforeOrder(type=STANDARD, amount=100.0, pending=True)
    assert BeforeCalculator().calculate_fee(order) == 0.0


def test_before_fee_for_a_shipped_standard_order_is_the_full_amount() -> None:
    order = BeforeOrder(type=STANDARD, amount=100.0, pending=False)
    assert BeforeCalculator().calculate_fee(order) == 100.0


def test_before_fee_and_description_for_an_express_order() -> None:
    order = BeforeOrder(type=EXPRESS, amount=100.0)
    assert BeforeCalculator().calculate_fee(order) == 15.0
    assert "express handling fee" in RefundDescription().describe(order)


def test_before_fee_for_a_subscription_order_is_prorated_by_elapsed_months() -> None:
    order = BeforeOrder(type=SUBSCRIPTION, amount=120.0, months_elapsed=3, total_months=12)
    assert BeforeCalculator().calculate_fee(order) == 30.0


def test_before_a_custom_made_order_gets_the_wrong_refund_description_despite_the_right_fee() -> None:
    order = BeforeOrder(type=CUSTOM_MADE, amount=200.0)
    assert BeforeCalculator().calculate_fee(order) == 100.0
    assert RefundDescription().describe(order) == "Refund processed"


def test_after_fee_for_a_pending_standard_order_is_free() -> None:
    order = AfterOrder(type=AFTER_STANDARD, amount=100.0, pending=True)
    assert AfterCalculator().calculate_fee(order) == 0.0


def test_after_fee_for_a_shipped_standard_order_is_the_full_amount() -> None:
    order = AfterOrder(type=AFTER_STANDARD, amount=100.0, pending=False)
    assert AfterCalculator().calculate_fee(order) == 100.0


def test_after_fee_and_description_for_an_express_order() -> None:
    order = AfterOrder(type=AFTER_EXPRESS, amount=100.0)
    calculator = AfterCalculator()
    assert calculator.calculate_fee(order) == 15.0
    assert "express handling fee" in calculator.describe_refund(order)


def test_after_fee_for_a_subscription_order_is_prorated_by_elapsed_months() -> None:
    order = AfterOrder(type=AFTER_SUBSCRIPTION, amount=120.0, months_elapsed=3, total_months=12)
    assert AfterCalculator().calculate_fee(order) == 30.0


def test_after_a_custom_made_order_gets_its_own_refund_description() -> None:
    order = AfterOrder(type=AFTER_CUSTOM_MADE, amount=200.0)
    calculator = AfterCalculator()
    assert calculator.calculate_fee(order) == 100.0
    assert calculator.describe_refund(order) == "50% refund, materials already committed"


class GiftFeePolicy:
    """A brand-new order type; no existing policy or calculator file is
    touched to add it."""

    def fee(self, order: AfterOrder) -> float:
        return 0.0

    def describe_refund(self, order: AfterOrder) -> str:
        return "Full refund, gift orders are always free to cancel"


def test_after_adding_a_gift_policy_needs_no_change_to_existing_policies() -> None:
    policies: dict[str, FeePolicy] = {**DEFAULT_POLICIES, "gift": GiftFeePolicy()}
    calculator = AfterCalculator(policies)
    order = AfterOrder(type="gift", amount=50.0)
    assert calculator.calculate_fee(order) == 0.0
    assert calculator.describe_refund(order) == "Full refund, gift orders are always free to cancel"
