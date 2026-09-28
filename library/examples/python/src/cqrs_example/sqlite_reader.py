import sqlite3

from cqrs_example.queries import OrderSummary


class SqliteOrderSummaryReader:
    def __init__(self, connection: sqlite3.Connection) -> None:
        self.connection = connection

    def get_summary(self, order_id: int) -> OrderSummary | None:
        # Project straight into display data; don't load a domain entity.
        row = self.connection.execute(
            "SELECT id, status, status = 'pending' FROM orders WHERE id = ?", (order_id,)
        ).fetchone()
        return OrderSummary(row[0], row[1], bool(row[2])) if row is not None else None
