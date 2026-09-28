import pytest

from red_green_refactor.green import Order as GreenOrder
from red_green_refactor.red import Order as RedOrder
from red_green_refactor.refactor import Order as RefactorOrder


def test_red_cancelling_a_shipped_order_is_still_allowed() -> None:
    # The new rule doesn't exist yet: this passing test pins the flaw it will fix.
    order = RedOrder(status="shipped")
    order.cancel()
    assert order.status == "cancelled"


@pytest.mark.parametrize("make_order", [GreenOrder, RefactorOrder], ids=["green", "refactor"])
def test_cancelling_a_pending_order_succeeds(make_order: type) -> None:
    # One shared test body runs against both stages: green and refactor must behave identically.
    order = make_order(status="pending")
    order.cancel()
    assert order.status == "cancelled"


@pytest.mark.parametrize("make_order", [GreenOrder, RefactorOrder], ids=["green", "refactor"])
def test_cancelling_a_shipped_order_is_rejected(make_order: type) -> None:
    order = make_order(status="shipped")
    with pytest.raises(ValueError, match="shipped"):
        order.cancel()
    assert order.status == "shipped"
