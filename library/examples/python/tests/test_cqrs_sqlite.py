import sqlite3
from contextlib import closing

import pytest

from cqrs_example.queries import GetOrderSummary, OrderSummary
from cqrs_example.sqlite_reader import SqliteOrderSummaryReader
from repository_example.application.cancel_order import CancelOrder, OrderNotFound
from repository_example.domain.order import Order
from repository_example.infrastructure.sqlite_order_repository import (
    SqliteOrderRepository,
    initialize_schema,
)


def test_sqlite_read_and_write_models_share_one_database() -> None:
    with closing(sqlite3.connect(":memory:")) as connection:
        initialize_schema(connection)
        repository = SqliteOrderRepository(connection)
        reader = SqliteOrderSummaryReader(connection)
        query = GetOrderSummary(reader)
        assert reader.get_summary(42) is None
        with pytest.raises(OrderNotFound):
            query.execute(42)
        repository.save(Order(1))
        before = query.execute(1)
        assert before == OrderSummary(1, "pending", True)
        assert repository.get(1) == Order(1)
        CancelOrder(repository).execute(1)
        assert query.execute(1) == OrderSummary(1, "cancelled", False)
        assert before == OrderSummary(1, "pending", True)
