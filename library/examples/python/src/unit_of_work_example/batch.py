from sqlalchemy import Engine
from sqlalchemy.orm import Session

from orm_example.repository import OrderRow
from repository_example.application.cancel_order import OrderNotFound
from repository_example.domain.order import Order, OrderStatus


def cancel_orders(engine: Engine, order_ids: list[int]) -> None:
    # The session tracks changes; the outer transaction owns commit/rollback.
    with Session(engine) as session, session.begin():
        for order_id in order_ids:
            row = session.get(OrderRow, order_id)
            if row is None:
                raise OrderNotFound(f"Order {order_id} not found")
            order = Order(row.id, OrderStatus(row.status))
            order.cancel()
            row.status = order.status.value
            session.flush()  # SQL has run, but nothing is committed yet.
