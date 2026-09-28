import pytest

from cqrs_example.before import OrderService
from cqrs_example.in_memory_reader import InMemoryOrderSummaryReader
from cqrs_example.queries import GetOrderSummary, OrderSummary
from repository_example.application.cancel_order import CancelOrder, OrderNotFound
from repository_example.domain.order import Order, OrderAlreadyCancelled
from repository_example.infrastructure.in_memory_order_repository import (
    InMemoryOrderRepository,
)


def test_queries_are_snapshots_and_commands_keep_domain_rules() -> None:
    repository = InMemoryOrderRepository()
    repository.save(Order(1))
    query = GetOrderSummary(InMemoryOrderSummaryReader(repository))
    before = query.execute(1)
    assert before == OrderSummary(1, "pending", True)
    assert repository.get(1) == Order(1)  # Reading didn't change the order.
    CancelOrder(repository).execute(1)
    assert query.execute(1) == OrderSummary(1, "cancelled", False)
    assert before == OrderSummary(1, "pending", True)
    with pytest.raises(OrderAlreadyCancelled):
        CancelOrder(repository).execute(1)
    assert query.execute(1) == OrderSummary(1, "cancelled", False)


def test_unknown_query_does_not_create_an_order() -> None:
    repository = InMemoryOrderRepository()
    reader = InMemoryOrderSummaryReader(repository)
    assert reader.get_summary(42) is None
    with pytest.raises(OrderNotFound):
        GetOrderSummary(reader).execute(42)
    assert repository.get(42) is None


def test_before_returns_the_write_model() -> None:
    repository = InMemoryOrderRepository()
    repository.save(Order(1))
    service = OrderService(repository)
    order = service.cancel_and_get(1)
    assert isinstance(order, Order)
    assert order == repository.get(1)
    with pytest.raises(OrderAlreadyCancelled):
        service.cancel_and_get(1)
    with pytest.raises(OrderNotFound):
        service.cancel_and_get(42)
