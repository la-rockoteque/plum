import pytest

from liskov_substitution.after.callers import (
    CancelExpiredOrders as AfterCancelExpiredOrders,
)
from liskov_substitution.after.callers import (
    CustomerServiceCancelTool as AfterCustomerServiceCancelTool,
)
from liskov_substitution.after.order import (
    CancellableOrder,
    GiftOrder as AfterGiftOrder,
    OrderStatus as AfterOrderStatus,
    StandardOrder,
    SubscriptionOrder,
)
from liskov_substitution.before.callers import (
    CancelExpiredOrders as BeforeCancelExpiredOrders,
)
from liskov_substitution.before.callers import (
    CustomerServiceCancelTool as BeforeCustomerServiceCancelTool,
)
from liskov_substitution.before.order import (
    GiftOrder as BeforeGiftOrder,
    Order as BeforeOrder,
    OrderStatus as BeforeOrderStatus,
)


def test_before_a_pending_order_can_be_cancelled() -> None:
    order = BeforeOrder(id=1, customer_name="Ada")
    order.cancel("customer requested")
    assert order.status == BeforeOrderStatus.CANCELLED


def test_before_a_gift_order_rejects_cancellation_even_while_pending() -> None:
    # The precondition GiftOrder accepts is stricter than Order's: Order allows
    # cancelling while pending, GiftOrder never does. That's the LSP violation.
    gift = BeforeGiftOrder(id=1, customer_name="Ada")
    with pytest.raises(ValueError, match="gift orders can't be cancelled online"):
        gift.cancel("customer requested")
    assert gift.status == BeforeOrderStatus.PENDING


def test_before_the_expired_orders_batch_must_skip_gift_orders_to_avoid_the_broken_contract() -> None:
    batch = BeforeCancelExpiredOrders()
    standard = BeforeOrder(id=1, customer_name="Ada")
    gift = BeforeGiftOrder(id=2, customer_name="Bob")
    cancelled, skipped = batch.execute([standard, gift], "expired")
    assert cancelled == [1]
    assert skipped == [2]
    assert standard.status == BeforeOrderStatus.CANCELLED
    assert gift.status == BeforeOrderStatus.PENDING


def test_before_the_customer_service_tool_must_special_case_gift_orders_to_avoid_the_broken_contract() -> None:
    tool = BeforeCustomerServiceCancelTool()
    standard = BeforeOrder(id=1, customer_name="Ada")
    gift = BeforeGiftOrder(id=2, customer_name="Bob")
    assert tool.cancel(standard, "changed my mind") == "order 1 cancelled: changed my mind"
    assert standard.status == BeforeOrderStatus.CANCELLED
    assert (
        tool.cancel(gift, "changed my mind")
        == "order 2 must be cancelled by phone: gift orders can't be cancelled online"
    )
    assert gift.status == BeforeOrderStatus.PENDING


CANCELLABLE_FACTORIES = {
    "standard order": lambda: StandardOrder(id=1, customer_name="Ada"),
    "subscription order": lambda: SubscriptionOrder(id=1, customer_name="Ada"),
}


@pytest.mark.parametrize("make_order", CANCELLABLE_FACTORIES.values(), ids=CANCELLABLE_FACTORIES.keys())
def test_after_any_cancellable_order_can_be_cancelled_while_pending(make_order) -> None:
    # The same contract body runs against every CancellableOrder subtype.
    order = make_order()
    order.cancel("customer requested")
    assert order.status == AfterOrderStatus.CANCELLED


@pytest.mark.parametrize("make_order", CANCELLABLE_FACTORIES.values(), ids=CANCELLABLE_FACTORIES.keys())
def test_after_any_cancellable_order_rejects_cancelling_an_already_cancelled_order(make_order) -> None:
    order = make_order()
    order.status = AfterOrderStatus.CANCELLED
    with pytest.raises(ValueError, match="cannot cancel a shipped or cancelled order"):
        order.cancel("customer requested")


def test_after_the_expired_orders_batch_cancels_every_cancellable_order_without_checking_its_type() -> None:
    batch = AfterCancelExpiredOrders()
    standard = StandardOrder(id=1, customer_name="Ada")
    subscription = SubscriptionOrder(id=2, customer_name="Bob")
    cancelled = batch.execute([standard, subscription], "expired")
    assert cancelled == [1, 2]
    assert standard.status == AfterOrderStatus.CANCELLED
    assert subscription.status == AfterOrderStatus.CANCELLED


def test_after_the_customer_service_tool_cancels_any_cancellable_order_without_checking_its_type() -> None:
    tool = AfterCustomerServiceCancelTool()
    standard = StandardOrder(id=1, customer_name="Ada")
    subscription = SubscriptionOrder(id=2, customer_name="Bob")
    assert tool.cancel(standard, "changed my mind") == "order 1 cancelled: changed my mind"
    assert tool.cancel(subscription, "changed my mind") == "order 2 cancelled: changed my mind"


def test_after_a_gift_order_does_not_satisfy_the_cancellable_order_contract() -> None:
    gift = AfterGiftOrder(id=1, customer_name="Ada")
    standard = StandardOrder(id=1, customer_name="Ada")
    assert not isinstance(gift, CancellableOrder)
    assert isinstance(standard, CancellableOrder)
