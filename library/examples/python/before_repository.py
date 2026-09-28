"""Teaching artifact: business rules and persistence in the same use case."""

import sqlite3


class CancelOrder:
    def __init__(self, connection: sqlite3.Connection) -> None:
        self.connection = connection

    def execute(self, order_id: int) -> None:
        # Application logic knows SQL and table/column names.
        # Persistence changes can force application changes; tests need a database.
        with self.connection:
            row = self.connection.execute(
                "SELECT status FROM orders WHERE id = ?", (order_id,)
            ).fetchone()
            if row is None:
                raise ValueError(f"Order {order_id} not found")
            if row[0] == "cancelled":
                raise ValueError(f"Order {order_id} already cancelled")
            self.connection.execute(
                "UPDATE orders SET status = 'cancelled' WHERE id = ?", (order_id,)
            )
