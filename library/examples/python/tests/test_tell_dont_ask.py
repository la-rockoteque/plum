import pytest

from tell_dont_ask.after import AdminCancelTool as AfterAdminCancelTool
from tell_dont_ask.after import ApiCancelHandler as AfterApiCancelHandler
from tell_dont_ask.after import NightlyCancelJob as AfterNightlyCancelJob
from tell_dont_ask.after import Order as AfterOrder
from tell_dont_ask.after import OrderStatus as AfterOrderStatus
from tell_dont_ask.before import AdminCancelTool as BeforeAdminCancelTool
from tell_dont_ask.before import ApiCancelHandler as BeforeApiCancelHandler
from tell_dont_ask.before import NightlyCancelJob as BeforeNightlyCancelJob
from tell_dont_ask.before import Order as BeforeOrder
from tell_dont_ask.before import OrderStatus as BeforeOrderStatus


class FakeClock:
    def __init__(self, now_ms: int) -> None:
        self._now_ms = now_ms

    def now_ms(self) -> int:
        return self._now_ms


def test_before_api_handler_cancels_a_pending_order_and_sets_the_refund() -> None:
    order = BeforeOrder(id=1, status=BeforeOrderStatus.PENDING, amount_paid_cents=5000)
    BeforeApiCancelHandler().cancel(order, FakeClock(1_000))
    assert order.status == BeforeOrderStatus.CANCELLED
    assert order.cancelled_at_ms == 1_000
    assert order.refund_due_cents == 5000


def test_before_nightly_job_cancels_a_stale_order_but_leaves_the_refund_unset() -> None:
    order = BeforeOrder(id=2, status=BeforeOrderStatus.PENDING, amount_paid_cents=5000)
    BeforeNightlyCancelJob().cancel(order, FakeClock(1_000))
    assert order.status == BeforeOrderStatus.CANCELLED
    assert order.cancelled_at_ms == 1_000
    assert order.refund_due_cents == 0  # bug: the payment is gone, no refund recorded


def test_before_admin_tool_cancels_an_already_shipped_order() -> None:
    order = BeforeOrder(
        id=3, status=BeforeOrderStatus.SHIPPED, amount_paid_cents=5000, shipped_at_ms=500
    )
    BeforeAdminCancelTool().cancel(order, FakeClock(1_000))
    assert order.status == BeforeOrderStatus.CANCELLED  # bug: a shipped order should stay shipped


def test_after_api_handler_nightly_job_and_admin_tool_all_cancel_the_same_way() -> None:
    clock = FakeClock(1_000)
    for handler, order in (
        (AfterApiCancelHandler(), AfterOrder(id=1, status=AfterOrderStatus.PENDING, amount_paid_cents=5000)),
        (AfterNightlyCancelJob(), AfterOrder(id=2, status=AfterOrderStatus.PENDING, amount_paid_cents=5000)),
        (AfterAdminCancelTool(), AfterOrder(id=3, status=AfterOrderStatus.PENDING, amount_paid_cents=5000)),
    ):
        handler.cancel(order, clock)
        assert order.status == AfterOrderStatus.CANCELLED
        assert order.cancelled_at_ms == 1_000
        assert order.refund_due_cents == 5000


def test_after_cancelling_an_already_shipped_order_is_rejected() -> None:
    clock = FakeClock(1_000)
    for handler in (AfterApiCancelHandler(), AfterNightlyCancelJob(), AfterAdminCancelTool()):
        order = AfterOrder(
            id=4, status=AfterOrderStatus.SHIPPED, amount_paid_cents=5000, shipped_at_ms=500
        )
        with pytest.raises(ValueError):
            handler.cancel(order, clock)
        assert order.status == AfterOrderStatus.SHIPPED
        assert order.cancelled_at_ms is None
        assert order.refund_due_cents == 0
