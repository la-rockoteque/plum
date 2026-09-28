"""Teaching artifact: presentation parsing, the cancellation rule and SQL in one function."""

import sqlite3
from dataclasses import dataclass


@dataclass
class CancelRequest:
    order_id: str  # arrives as a string, as it would from a web request


@dataclass
class CancelResponse:
    status: str  # "ok" | "invalid" | "not_found" | "rejected"
    message: str


def handle_cancel_request(request: CancelRequest, connection: sqlite3.Connection) -> CancelResponse:
    # Parsing, the cancellation rule, and SQL all live in one function: a rule change
    # and a column rename both force an edit here, and proving the rule needs a database.
    if not request.order_id.isdigit():
        return CancelResponse("invalid", "order id must be a number")
    order_id = int(request.order_id)

    with connection:
        row = connection.execute(
            "SELECT status FROM orders WHERE id = ?", (order_id,)
        ).fetchone()
        if row is None:
            return CancelResponse("not_found", f"order {order_id} not found")
        if row[0] in ("shipped", "cancelled"):
            return CancelResponse("rejected", f"order {order_id} already {row[0]}")
        connection.execute(
            "UPDATE orders SET status = 'cancelled' WHERE id = ?", (order_id,)
        )
        return CancelResponse("ok", f"order {order_id} cancelled")
