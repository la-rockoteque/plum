import sqlite3
from contextlib import closing

import pytest

from layered_architecture.after.application import CancelOrder, OrderNotFound
from layered_architecture.after.data import (
    InMemoryOrderRepository,
    SqliteOrderRepository,
    initialize_schema,
)
from layered_architecture.after.domain import Order, OrderCannotBeCancelled, OrderStatus
from layered_architecture.after.presentation import (
    CancelRequest,
    CancelResponse,
    handle_cancel_request,
)
from layered_architecture.before import CancelRequest as BeforeRequest
from layered_architecture.before import CancelResponse as BeforeResponse
from layered_architecture.before import handle_cancel_request as before_handle_cancel_request


def test_before_proving_the_cancellation_rule_requires_a_request_and_a_database() -> None:
    with closing(sqlite3.connect(":memory:")) as connection:
        connection.execute("CREATE TABLE orders (id INTEGER PRIMARY KEY, status TEXT)")
        connection.execute("INSERT INTO orders VALUES (1, 'pending'), (2, 'shipped')")

        response = before_handle_cancel_request(BeforeRequest("1"), connection)
        assert response == BeforeResponse("ok", "order 1 cancelled")
        assert connection.execute(
            "SELECT status FROM orders WHERE id = 1"
        ).fetchone() == ("cancelled",)

        # Proving the rule (a shipped order can't be cancelled) needs this same database.
        assert before_handle_cancel_request(BeforeRequest("2"), connection).status == "rejected"
        assert before_handle_cancel_request(BeforeRequest("1"), connection).status == "rejected"
        assert before_handle_cancel_request(BeforeRequest("42"), connection).status == "not_found"
        assert before_handle_cancel_request(BeforeRequest("nope"), connection).status == "invalid"


def test_after_the_domain_rule_rejects_a_shipped_order_with_no_request_or_database() -> None:
    with pytest.raises(OrderCannotBeCancelled):
        Order(1, OrderStatus.SHIPPED).cancel()


def test_after_the_domain_rule_rejects_a_cancelled_order_with_no_request_or_database() -> None:
    with pytest.raises(OrderCannotBeCancelled):
        Order(1, OrderStatus.CANCELLED).cancel()


def test_after_the_domain_rule_cancels_a_pending_order() -> None:
    order = Order(1)
    order.cancel()
    assert order.status == OrderStatus.CANCELLED


def test_after_the_application_service_cancels_through_an_in_memory_repository() -> None:
    repository = InMemoryOrderRepository()
    repository.save(Order(1))
    CancelOrder(repository).execute(1)
    assert repository.get(1) == Order(1, OrderStatus.CANCELLED)

    with pytest.raises(OrderNotFound):
        CancelOrder(repository).execute(42)

    repository.save(Order(2, OrderStatus.SHIPPED))
    with pytest.raises(OrderCannotBeCancelled):
        CancelOrder(repository).execute(2)


def test_after_the_handler_cancels_through_a_fake_application_service() -> None:
    class FakeCancelOrder:
        def __init__(self, error: Exception | None = None) -> None:
            self.error = error
            self.called_with: int | None = None

        def execute(self, order_id: int) -> None:
            self.called_with = order_id
            if self.error is not None:
                raise self.error

    use_case = FakeCancelOrder()
    response = handle_cancel_request(CancelRequest("1"), use_case)
    assert response == CancelResponse("ok", "order 1 cancelled")
    assert use_case.called_with == 1

    assert handle_cancel_request(CancelRequest("nope"), FakeCancelOrder()).status == "invalid"
    assert (
        handle_cancel_request(CancelRequest("1"), FakeCancelOrder(OrderNotFound("x"))).status
        == "not_found"
    )
    assert (
        handle_cancel_request(
            CancelRequest("1"), FakeCancelOrder(OrderCannotBeCancelled("x"))
        ).status
        == "rejected"
    )


def test_after_presentation_application_domain_and_data_cancel_an_order_on_sqlite() -> None:
    with closing(sqlite3.connect(":memory:")) as connection:
        initialize_schema(connection)
        repository = SqliteOrderRepository(connection)
        repository.save(Order(1))
        repository.save(Order(2, OrderStatus.SHIPPED))

        use_case = CancelOrder(repository)
        assert handle_cancel_request(CancelRequest("1"), use_case) == CancelResponse(
            "ok", "order 1 cancelled"
        )
        assert repository.get(1) == Order(1, OrderStatus.CANCELLED)
        assert handle_cancel_request(CancelRequest("2"), use_case).status == "rejected"
        assert handle_cancel_request(CancelRequest("42"), use_case).status == "not_found"
        assert handle_cancel_request(CancelRequest("nope"), use_case).status == "invalid"
