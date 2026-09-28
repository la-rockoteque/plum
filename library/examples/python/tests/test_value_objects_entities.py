import dataclasses

import pytest

from value_objects_entities.after import CurrencyMismatch, InvalidStatusTransition, Money, Order, OrderStatus, UnknownStatus
from value_objects_entities.before import Order as BeforeOrder
from value_objects_entities.before import add_totals


def test_before_an_invalid_status_string_is_accepted() -> None:
    order = BeforeOrder(id=1, status="pending", total=9.99, currency="USD")
    order.status = "definitely-not-a-status"
    assert order.status == "definitely-not-a-status"


def test_before_a_cancelled_order_can_be_moved_back_to_pending() -> None:
    order = BeforeOrder(id=1, status="cancelled", total=9.99, currency="USD")
    order.status = "pending"
    assert order.status == "pending"


def test_before_totals_in_different_currencies_are_added_together() -> None:
    usd_order = BeforeOrder(id=1, status="pending", total=10.0, currency="USD")
    eur_order = BeforeOrder(id=2, status="pending", total=5.0, currency="EUR")
    assert add_totals(usd_order, eur_order) == 15.0


def test_before_repeated_float_amounts_drift_from_the_exact_total() -> None:
    orders = [BeforeOrder(id=i, status="pending", total=0.1, currency="USD") for i in range(3)]
    total = add_totals(orders[0], orders[1]) + orders[2].total
    assert total != 0.3


def test_before_the_same_order_compares_unequal_to_itself_once_its_status_changes() -> None:
    order = BeforeOrder(id=1, status="pending", total=9.99, currency="USD")
    same_order_after_cancelling = dataclasses.replace(order, status="cancelled")
    assert order != same_order_after_cancelling


def test_after_parsing_an_unknown_status_is_rejected() -> None:
    with pytest.raises(UnknownStatus):
        OrderStatus.parse("definitely-not-a-status")


def test_after_shipping_a_pending_order_moves_it_to_shipped() -> None:
    order = Order(id=1, status=OrderStatus.PENDING, total=Money(999, "USD"))
    order.ship()
    assert order.status is OrderStatus.SHIPPED


def test_after_cancelling_a_shipped_order_is_rejected() -> None:
    order = Order(id=1, status=OrderStatus.PENDING, total=Money(999, "USD"))
    order.ship()
    with pytest.raises(InvalidStatusTransition):
        order.cancel()


def test_after_cancelling_a_cancelled_order_is_rejected() -> None:
    order = Order(id=1, status=OrderStatus.PENDING, total=Money(999, "USD"))
    order.cancel()
    with pytest.raises(InvalidStatusTransition):
        order.cancel()


def test_after_a_cancelled_order_cannot_move_back_to_pending() -> None:
    order = Order(id=1, status=OrderStatus.PENDING, total=Money(999, "USD"))
    order.cancel()
    with pytest.raises(InvalidStatusTransition):
        order.status.transition_to(OrderStatus.PENDING)


def test_after_assigning_to_status_directly_is_rejected() -> None:
    order = Order(id=1, status=OrderStatus.PENDING, total=Money(999, "USD"))
    order.cancel()
    with pytest.raises(AttributeError):
        order.status = OrderStatus.PENDING  # type: ignore[misc]
    assert order.status is OrderStatus.CANCELLED


def test_after_adding_money_in_different_currencies_is_rejected() -> None:
    with pytest.raises(CurrencyMismatch):
        Money(1000, "USD").add(Money(500, "EUR"))


def test_after_repeated_money_amounts_do_not_drift() -> None:
    total = Money(10, "USD").add(Money(10, "USD")).add(Money(10, "USD"))
    assert total == Money(30, "USD")


def test_after_money_with_equal_amount_and_currency_is_equal_by_value() -> None:
    assert Money(1000, "USD") == Money(1000, "USD")
    assert Money(1000, "USD") != Money(1000, "EUR")


def test_after_money_is_immutable() -> None:
    a = Money(1000, "USD")
    b = Money(500, "USD")
    c = a.add(b)
    assert a == Money(1000, "USD")
    assert c == Money(1500, "USD")
    assert c is not a
    with pytest.raises(dataclasses.FrozenInstanceError):
        a.amount_minor = 2000  # type: ignore[misc]


def test_after_two_orders_with_equal_fields_but_different_ids_are_not_equal() -> None:
    total = Money(500, "USD")
    order_a = Order(id=1, status=OrderStatus.PENDING, total=total)
    order_b = Order(id=2, status=OrderStatus.PENDING, total=total)
    assert order_a != order_b

    order_c = Order(id=1, status=OrderStatus.PENDING, total=total)
    order_c.cancel()
    assert order_a == order_c
