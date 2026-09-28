import pytest

from aggregates.after import (
    CurrencyMismatchError,
    InvalidQuantityError,
    Order,
    OrderCancelledError,
    OrderRepository,
    OrderStatus,
    TooManyLinesError,
)
from aggregates.before import Order as BeforeOrder
from aggregates.before import OrderLine, OrderLineRepository, recompute_total


def test_before_adding_a_line_does_not_update_the_cached_total() -> None:
    order = BeforeOrder(id=1)
    repo = OrderLineRepository()
    repo.add(OrderLine(id=1, order_id=1, sku="WIDGET", quantity=2, unit_price_minor=500, currency="USD"))
    assert order.total_minor == 0


def test_before_an_eleventh_line_is_accepted() -> None:
    repo = OrderLineRepository()
    for i in range(11):
        repo.add(OrderLine(id=i, order_id=1, sku=f"SKU-{i}", quantity=1, unit_price_minor=100, currency="USD"))
    assert len(repo.for_order(1)) == 11


def test_before_a_lines_quantity_can_be_set_to_zero() -> None:
    repo = OrderLineRepository()
    repo.add(OrderLine(id=1, order_id=1, sku="WIDGET", quantity=2, unit_price_minor=500, currency="USD"))
    repo.update_quantity(1, 0)
    assert repo.for_order(1)[0].quantity == 0


def test_before_a_cancelled_orders_line_can_still_be_changed() -> None:
    order = BeforeOrder(id=1, status="cancelled")
    repo = OrderLineRepository()
    repo.add(OrderLine(id=1, order_id=1, sku="WIDGET", quantity=2, unit_price_minor=500, currency="USD"))
    repo.update_quantity(1, 5)
    assert order.status == "cancelled"
    assert repo.for_order(1)[0].quantity == 5


def test_before_a_line_fetched_from_the_repository_can_be_mutated_directly() -> None:
    repo = OrderLineRepository()
    repo.add(OrderLine(id=1, order_id=1, sku="WIDGET", quantity=2, unit_price_minor=500, currency="USD"))
    fetched = repo.for_order(1)[0]
    fetched.quantity = 99
    assert repo.for_order(1)[0].quantity == 99


def test_before_recompute_total_must_be_called_manually_to_stay_correct() -> None:
    order = BeforeOrder(id=1)
    repo = OrderLineRepository()
    repo.add(OrderLine(id=1, order_id=1, sku="WIDGET", quantity=2, unit_price_minor=500, currency="USD"))
    recompute_total(order, repo.for_order(1))
    assert order.total_minor == 1000
    repo.update_quantity(1, 5)
    assert order.total_minor == 1000  # stale again: nobody recomputed after the change


def test_after_adding_a_line_updates_the_total_immediately() -> None:
    order = Order(id=1)
    order.add_line(sku="WIDGET", quantity=2, unit_price_minor=500, currency="USD")
    assert order.total_minor == 1000


def test_after_an_eleventh_line_is_rejected() -> None:
    order = Order(id=1)
    for i in range(10):
        order.add_line(sku=f"SKU-{i}", quantity=1, unit_price_minor=100, currency="USD")
    with pytest.raises(TooManyLinesError):
        order.add_line(sku="SKU-10", quantity=1, unit_price_minor=100, currency="USD")


def test_after_changing_a_lines_quantity_to_zero_is_rejected() -> None:
    order = Order(id=1)
    line_id = order.add_line(sku="WIDGET", quantity=2, unit_price_minor=500, currency="USD")
    with pytest.raises(InvalidQuantityError):
        order.change_quantity(line_id, 0)


def test_after_changing_a_line_on_a_cancelled_order_is_rejected() -> None:
    order = Order(id=1)
    line_id = order.add_line(sku="WIDGET", quantity=2, unit_price_minor=500, currency="USD")
    order.cancel()
    with pytest.raises(OrderCancelledError):
        order.change_quantity(line_id, 3)


def test_after_cancelling_a_shipped_or_already_cancelled_order_is_rejected() -> None:
    shipped = Order(id=1, status=OrderStatus.SHIPPED)
    with pytest.raises(OrderCancelledError):
        shipped.cancel()

    cancelled = Order(id=2, status=OrderStatus.CANCELLED)
    with pytest.raises(OrderCancelledError):
        cancelled.cancel()


def test_after_adding_a_line_in_another_currency_is_rejected() -> None:
    order = Order(id=1, currency="USD")
    with pytest.raises(CurrencyMismatchError):
        order.add_line(sku="WIDGET", quantity=1, unit_price_minor=500, currency="EUR")


def test_after_the_lines_returned_by_the_order_are_copies_that_cannot_mutate_it() -> None:
    order = Order(id=1)
    order.add_line(sku="WIDGET", quantity=2, unit_price_minor=500, currency="USD")
    fetched = order.lines[0]
    fetched.quantity = 99
    assert order.lines[0].quantity == 2
    assert order.total_minor == 1000


def test_after_the_repository_saves_and_loads_the_whole_order() -> None:
    order = Order(id=1)
    order.add_line(sku="WIDGET", quantity=2, unit_price_minor=500, currency="USD")
    repo = OrderRepository()
    repo.save(order)

    # Mutating the original after save must not reach the stored copy.
    order.add_line(sku="GADGET", quantity=1, unit_price_minor=250, currency="USD")

    loaded = repo.get(1)
    assert loaded is not None
    assert loaded.total_minor == 1000
    assert len(loaded.lines) == 1

    # Mutating the loaded copy must not reach the stored order either.
    loaded.add_line(sku="MUTATED", quantity=1, unit_price_minor=1, currency="USD")
    again = repo.get(1)
    assert again is not None
    assert again.total_minor == 1000
