import argparse
import sqlite3
from contextlib import closing

from cqrs_example.before import OrderService
from cqrs_example.in_memory_reader import InMemoryOrderSummaryReader
from cqrs_example.queries import GetOrderSummary, OrderSummaryReader
from cqrs_example.sqlite_reader import SqliteOrderSummaryReader
from repository_example.application.cancel_order import CancelOrder
from repository_example.application.order_repository import OrderRepository
from repository_example.domain.order import Order
from repository_example.infrastructure.in_memory_order_repository import (
    InMemoryOrderRepository,
)
from repository_example.infrastructure.sqlite_order_repository import (
    SqliteOrderRepository,
    initialize_schema,
)


def demonstrate(repository: OrderRepository, reader: OrderSummaryReader) -> None:
    repository.save(Order(1))
    query = GetOrderSummary(reader)
    before = query.execute(1)
    CancelOrder(repository).execute(1)
    after = query.execute(1)
    print(f"Before: {before.status}, can_cancel={str(before.can_cancel).lower()}")
    print(f"After: {after.status}, can_cancel={str(after.can_cancel).lower()}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Separate order commands and queries")
    parser.add_argument("mode", choices=["before", "memory", "sqlite"])
    mode = parser.parse_args().mode
    if mode == "sqlite":
        with closing(sqlite3.connect(":memory:")) as connection:
            initialize_schema(connection)
            demonstrate(SqliteOrderRepository(connection), SqliteOrderSummaryReader(connection))
    else:
        repository = InMemoryOrderRepository()
        if mode == "before":
            repository.save(Order(1))
            order = OrderService(repository).cancel_and_get(1)
            print(f"Order {order.id}: {order.status.value}")
        else:
            demonstrate(repository, InMemoryOrderSummaryReader(repository))


if __name__ == "__main__":
    main()
