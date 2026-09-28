import pytest

from aggregates.after import (
    InvalidQuantityError,
    Order,
    OrderCancelledError,
    OrderRepository,
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
    order.add_line(sku="WIDGET", quantity=2, unit_price_minor=500)
    assert order.total_minor == 1000


def test_after_an_eleventh_line_is_rejected() -> None:
    order = Order(id=1)
    for i in range(10):
        order.add_line(sku=f"SKU-{i}", quantity=1, unit_price_minor=100)
    with pytest.raises(TooManyLinesError):
        order.add_line(sku="SKU-10", quantity=1, unit_price_minor=100)


def test_after_changing_a_lines_quantity_to_zero_is_rejected() -> None:
    order = Order(id=1)
    line_id = order.add_line(sku="WIDGET", quantity=2, unit_price_minor=500)
    with pytest.raises(InvalidQuantityError):
        order.change_quantity(line_id, 0)


def test_after_changing_a_line_on_a_cancelled_order_is_rejected() -> None:
    order = Order(id=1)
    line_id = order.add_line(sku="WIDGET", quantity=2, unit_price_minor=500)
    order.cancel()
    with pytest.raises(OrderCancelledError):
        order.change_quantity(line_id, 3)


def test_after_the_lines_returned_by_the_order_are_copies_that_cannot_mutate_it() -> None:
    order = Order(id=1)
    order.add_line(sku="WIDGET", quantity=2, unit_price_minor=500)
    fetched = order.lines[0]
    fetched.quantity = 99
    assert order.lines[0].quantity == 2
    assert order.total_minor == 1000


def test_after_the_repository_saves_and_loads_the_whole_order() -> None:
    order = Order(id=1)
    order.add_line(sku="WIDGET", quantity=2, unit_price_minor=500)
    repo = OrderRepository()
    repo.save(order)

    loaded = repo.get(1)
    assert loaded is not None
    assert loaded.total_minor == 1000
    assert len(loaded.lines) == 1
