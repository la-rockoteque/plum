from yagni_kiss.after import Order as AfterOrder
from yagni_kiss.after import OrderStatus as AfterStatus
from yagni_kiss.before import Order as BeforeOrder
from yagni_kiss.before import OrderCancellationService
from yagni_kiss.before import OrderStatus as BeforeStatus

NOW_MS = 10_000_000
WINDOW_MS = 24 * 60 * 60 * 1000


class FixedClock:
    def __init__(self, now_ms: int) -> None:
        self._now_ms = now_ms

    def now_ms(self) -> int:
        return self._now_ms


def test_before_a_fresh_pending_order_can_be_cancelled() -> None:
    order = BeforeOrder(1, BeforeStatus.PENDING, NOW_MS)
    clock = FixedClock(NOW_MS)
    assert OrderCancellationService().can_cancel(order, clock) is True


def test_before_an_order_past_the_cancellation_window_cannot_be_cancelled() -> None:
    order = BeforeOrder(1, BeforeStatus.PENDING, NOW_MS - WINDOW_MS * 2)
    clock = FixedClock(NOW_MS)
    assert OrderCancellationService().can_cancel(order, clock) is False


def test_before_a_shipped_order_cannot_be_cancelled() -> None:
    order = BeforeOrder(1, BeforeStatus.SHIPPED, NOW_MS)
    clock = FixedClock(NOW_MS)
    assert OrderCancellationService().can_cancel(order, clock) is False


def test_before_a_typo_in_the_policy_config_name_silently_falls_back_to_the_default_policy() -> None:
    order = BeforeOrder(1, BeforeStatus.PENDING, NOW_MS)
    clock = FixedClock(NOW_MS)
    correctly_named = OrderCancellationService(policy_name="standard")
    typo_named = OrderCancellationService(policy_name="stadnard")
    assert typo_named.can_cancel(order, clock) == correctly_named.can_cancel(order, clock)


def test_before_the_unused_cancellation_hooks_are_never_invoked() -> None:
    service = OrderCancellationService()
    assert service.hooks.on_before_cancel == []
    assert service.hooks.on_after_cancel == []


def test_after_a_fresh_pending_order_can_be_cancelled() -> None:
    order = AfterOrder(1, AfterStatus.PENDING, NOW_MS)
    clock = FixedClock(NOW_MS)
    assert order.can_be_cancelled(clock) is True


def test_after_an_order_past_the_cancellation_window_cannot_be_cancelled() -> None:
    order = AfterOrder(1, AfterStatus.PENDING, NOW_MS - WINDOW_MS * 2)
    clock = FixedClock(NOW_MS)
    assert order.can_be_cancelled(clock) is False


def test_after_a_shipped_order_cannot_be_cancelled() -> None:
    order = AfterOrder(1, AfterStatus.SHIPPED, NOW_MS)
    clock = FixedClock(NOW_MS)
    assert order.can_be_cancelled(clock) is False
