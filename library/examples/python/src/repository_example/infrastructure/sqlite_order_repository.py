import sqlite3

from repository_example.domain.order import Order, OrderStatus


def initialize_schema(connection: sqlite3.Connection) -> None:
    with connection:
        connection.execute(
            "CREATE TABLE IF NOT EXISTS orders "
            "(id INTEGER PRIMARY KEY, status TEXT NOT NULL)"
        )


class SqliteOrderRepository:
    """Caller owns the connection; each save commits its transaction."""

    def __init__(self, connection: sqlite3.Connection) -> None:
        self.connection = connection

    def get(self, order_id: int) -> Order | None:
        row = self.connection.execute(
            "SELECT id, status FROM orders WHERE id = ?", (order_id,)
        ).fetchone()
        return Order(row[0], OrderStatus(row[1])) if row is not None else None

    def save(self, order: Order) -> None:
        with self.connection:
            self.connection.execute(
                "INSERT INTO orders (id, status) VALUES (?, ?) "
                "ON CONFLICT(id) DO UPDATE SET status = excluded.status",
                (order.id, order.status.value),
            )
