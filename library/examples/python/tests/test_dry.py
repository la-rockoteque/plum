from dry.after import ApiCancelHandler as AfterApi
from dry.after import CliCancelHandler as AfterCli
from dry.after import Order as AfterOrder
from dry.after import OrderStatus as AfterStatus
from dry.before import ApiCancelHandler as BeforeApi
from dry.before import CliCancelHandler as BeforeCli
from dry.before import Order as BeforeOrder
from dry.before import OrderStatus as BeforeStatus

NOW_MS = 10_000_000
WINDOW_MS = 24 * 60 * 60 * 1000


class FixedClock:
    def __init__(self, now_ms: int) -> None:
        self._now_ms = now_ms

    def now_ms(self) -> int:
        return self._now_ms


def test_before_cli_and_api_agree_a_fresh_pending_order_can_be_cancelled() -> None:
    order = BeforeOrder(1, BeforeStatus.PENDING, NOW_MS)
    clock = FixedClock(NOW_MS)
    assert BeforeCli().can_cancel(order, clock) is True
    assert BeforeApi().can_cancel(order, clock) is True


def test_before_cli_and_api_disagree_once_the_cancellation_window_has_passed() -> None:
    order = BeforeOrder(1, BeforeStatus.PENDING, NOW_MS - WINDOW_MS * 2)
    clock = FixedClock(NOW_MS)
    assert BeforeCli().can_cancel(order, clock) is False
    assert BeforeApi().can_cancel(order, clock) is True


def test_before_neither_handler_allows_cancelling_a_shipped_order() -> None:
    order = BeforeOrder(1, BeforeStatus.SHIPPED, NOW_MS)
    clock = FixedClock(NOW_MS)
    assert BeforeCli().can_cancel(order, clock) is False
    assert BeforeApi().can_cancel(order, clock) is False


def test_after_cli_and_api_agree_a_fresh_pending_order_can_be_cancelled() -> None:
    order = AfterOrder(1, AfterStatus.PENDING, NOW_MS)
    clock = FixedClock(NOW_MS)
    assert AfterCli().can_cancel(order, clock) is True
    assert AfterApi().can_cancel(order, clock) is True


def test_after_cli_and_api_agree_once_the_cancellation_window_has_passed() -> None:
    order = AfterOrder(1, AfterStatus.PENDING, NOW_MS - WINDOW_MS * 2)
    clock = FixedClock(NOW_MS)
    assert AfterCli().can_cancel(order, clock) is False
    assert AfterApi().can_cancel(order, clock) is False


def test_after_neither_handler_allows_cancelling_a_shipped_order() -> None:
    order = AfterOrder(1, AfterStatus.SHIPPED, NOW_MS)
    clock = FixedClock(NOW_MS)
    assert AfterCli().can_cancel(order, clock) is False
    assert AfterApi().can_cancel(order, clock) is False
