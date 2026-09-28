import sqlite3
from contextlib import closing

import pytest

from before_repository import CancelOrder


def test_coupled_cancellation() -> None:
    with closing(sqlite3.connect(":memory:")) as connection:
        connection.execute("CREATE TABLE orders (id INTEGER PRIMARY KEY, status TEXT)")
        connection.execute("INSERT INTO orders VALUES (1, 'pending')")
        use_case = CancelOrder(connection)
        use_case.execute(1)
        assert connection.execute("SELECT status FROM orders").fetchone() == (
            "cancelled",
        )
        with pytest.raises(ValueError, match="already cancelled"):
            use_case.execute(1)
        with pytest.raises(ValueError, match="not found"):
            use_case.execute(2)
