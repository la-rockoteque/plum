from sqlalchemy import Engine, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column

from repository_example.domain.order import Order, OrderStatus


class Base(DeclarativeBase):
    pass


class OrderRow(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=False)
    status: Mapped[str] = mapped_column(Text)


class SqlAlchemyOrderRepository:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def get(self, order_id: int) -> Order | None:
        with Session(self.engine) as session:
            row = session.get(OrderRow, order_id)
            # Return a domain snapshot, never the session-managed ORM object.
            return Order(row.id, OrderStatus(row.status)) if row is not None else None

    def save(self, order: Order) -> None:
        with Session(self.engine) as session, session.begin():
            session.merge(OrderRow(id=order.id, status=order.status.value))
        # The transaction commits before this method returns.
