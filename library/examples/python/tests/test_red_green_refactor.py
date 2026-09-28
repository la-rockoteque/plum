import pytest

from red_green_refactor.green import Order as GreenOrder
from red_green_refactor.red import Order as RedOrder
from red_green_refactor.refactor import Order as RefactorOrder
from red_green_refactor.refactor import OrderStatus


def test_red_cancelling_a_shipped_order_is_still_allowed() -> None:
    # The new rule doesn't exist yet: this passing test pins the flaw it will fix.
    order = RedOrder(status="shipped")
    order.cancel()
    assert order.status == "cancelled"


def test_green_cancelling_a_pending_order_succeeds() -> None:
    order = GreenOrder(status="pending")
    order.cancel()
    assert order.status == "cancelled"


def test_green_cancelling_a_shipped_order_is_rejected() -> None:
    order = GreenOrder(status="shipped")
    with pytest.raises(ValueError, match="shipped"):
        order.cancel()
    assert order.status == "shipped"


def test_refactor_cancelling_a_pending_order_succeeds() -> None:
    # Same case as green, run against the refactored design.
    order = RefactorOrder(OrderStatus.PENDING)
    order.cancel()
    assert order.status == OrderStatus.CANCELLED


def test_refactor_cancelling_a_shipped_order_is_rejected() -> None:
    # Same case as green, run against the refactored design.
    order = RefactorOrder(OrderStatus.SHIPPED)
    with pytest.raises(ValueError, match="shipped"):
        order.cancel()
    assert order.status == OrderStatus.SHIPPED
