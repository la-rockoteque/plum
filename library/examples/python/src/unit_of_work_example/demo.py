from sqlalchemy import create_engine, text

from orm_example.repository import Base, SqlAlchemyOrderRepository
from repository_example.application.cancel_order import CancelOrder, OrderNotFound
from repository_example.domain.order import Order
from unit_of_work_example.batch import cancel_orders


def main() -> None:
    engine = create_engine("sqlite://")
    try:
        Base.metadata.create_all(engine)
        repository = SqlAlchemyOrderRepository(engine)
        for mode in ("before", "rollback", "commit"):
            repository.save(Order(1))
            repository.save(Order(2))
            ids = [1, 2] if mode == "commit" else [1, 404]
            try:
                if mode == "before":
                    for order_id in ids:
                        CancelOrder(repository).execute(order_id)
                else:
                    cancel_orders(engine, ids)
            except OrderNotFound:
                if mode == "commit":
                    raise
            with engine.connect() as connection:
                statuses = connection.execute(text("SELECT status FROM orders ORDER BY id")).scalars().all()
            expected = {
                "before": ["cancelled", "pending"],
                "rollback": ["pending", "pending"],
                "commit": ["cancelled", "cancelled"],
            }[mode]
            assert statuses == expected
            print(f"{mode}: {', '.join(statuses)}")
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
