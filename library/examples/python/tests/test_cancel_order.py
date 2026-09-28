import pytest

from repository_example.application.cancel_order import CancelOrder, OrderNotFound
from repository_example.domain.order import Order, OrderAlreadyCancelled, OrderStatus
from repository_example.infrastructure.in_memory_order_repository import (
    InMemoryOrderRepository,
)


def test_cancel_pending_order() -> None:
    repository = InMemoryOrderRepository()
    repository.save(Order(1))
    CancelOrder(repository).execute(1)
    assert repository.get(1) == Order(1, OrderStatus.CANCELLED)


def test_cancel_unknown_order() -> None:
    repository = InMemoryOrderRepository()
    with pytest.raises(OrderNotFound):
        CancelOrder(repository).execute(1)
    assert repository.get(1) is None


def test_cannot_cancel_twice() -> None:
    repository = InMemoryOrderRepository()
    repository.save(Order(1, OrderStatus.CANCELLED))
    with pytest.raises(OrderAlreadyCancelled):
        CancelOrder(repository).execute(1)
    assert repository.get(1) == Order(1, OrderStatus.CANCELLED)
