import sqlite3
from collections.abc import Iterator
from contextlib import closing

import pytest

from repository_example.application.order_repository import OrderRepository
from repository_example.domain.order import Order, OrderStatus
from repository_example.infrastructure.in_memory_order_repository import (
    InMemoryOrderRepository,
)
from repository_example.infrastructure.sqlite_order_repository import (
    SqliteOrderRepository,
    initialize_schema,
)


@pytest.fixture(params=["memory", "sqlite"])
def repository(request: pytest.FixtureRequest) -> Iterator[OrderRepository]:
    if request.param == "memory":
        yield InMemoryOrderRepository()
    else:
        with closing(sqlite3.connect(":memory:")) as connection:
            initialize_schema(connection)
            yield SqliteOrderRepository(connection)


def test_save_get_round_trip(repository: OrderRepository) -> None:
    repository.save(Order(1))
    assert repository.get(1) == Order(1)


def test_unknown_order(repository: OrderRepository) -> None:
    assert repository.get(42) is None


def test_update_existing_order(repository: OrderRepository) -> None:
    repository.save(Order(1))
    order = repository.get(1)
    assert order is not None
    order.cancel()
    repository.save(order)
    assert repository.get(1) == Order(1, OrderStatus.CANCELLED)


def test_changes_require_save(repository: OrderRepository) -> None:
    original = Order(1)
    repository.save(original)
    original.cancel()
    assert repository.get(1) == Order(1)
    loaded = repository.get(1)
    assert loaded is not None
    loaded.cancel()
    assert repository.get(1) == Order(1)


def test_sqlite_save_commits() -> None:
    with closing(sqlite3.connect(":memory:")) as connection:
        initialize_schema(connection)
        SqliteOrderRepository(connection).save(Order(1))
        connection.rollback()
        assert SqliteOrderRepository(connection).get(1) == Order(1)
