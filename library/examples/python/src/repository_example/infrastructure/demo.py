import argparse
import sqlite3
from contextlib import closing

from repository_example.application.cancel_order import CancelOrder
from repository_example.application.order_repository import OrderRepository
from repository_example.domain.order import Order, OrderStatus
from repository_example.infrastructure.in_memory_order_repository import (
    InMemoryOrderRepository,
)
from repository_example.infrastructure.sqlite_order_repository import (
    SqliteOrderRepository,
    initialize_schema,
)


def demonstrate(repository: OrderRepository) -> None:
    repository.save(Order(1))
    CancelOrder(repository).execute(1)
    order = repository.get(1)
    assert order == Order(1, OrderStatus.CANCELLED)
    print(f"Order {order.id}: {order.status.value}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Cancel an order with either adapter")
    parser.add_argument("adapter", choices=["memory", "sqlite"])
    args = parser.parse_args()
    if args.adapter == "memory":
        demonstrate(InMemoryOrderRepository())
    else:
        with closing(sqlite3.connect(":memory:")) as connection:
            initialize_schema(connection)
            demonstrate(SqliteOrderRepository(connection))


if __name__ == "__main__":
    main()
