import pytest
from sqlalchemy import create_engine

from orm_example.repository import Base, SqlAlchemyOrderRepository
from repository_example.application.cancel_order import CancelOrder, OrderNotFound
from repository_example.domain.order import Order, OrderAlreadyCancelled, OrderStatus


def test_sqlalchemy_keeps_the_repository_contract() -> None:
    engine = create_engine("sqlite://")
    try:
        Base.metadata.create_all(engine)
        repository = SqlAlchemyOrderRepository(engine)
        assert repository.get(42) is None
        with pytest.raises(OrderNotFound):
            CancelOrder(repository).execute(42)
        original = Order(1)
        repository.save(original)
        original.cancel()
        loaded = repository.get(1)
        assert loaded == Order(1)
        loaded.cancel()
        assert repository.get(1) == Order(1)  # No ORM tracking leaks into the domain.
        CancelOrder(repository).execute(1)
        assert repository.get(1) == Order(1, OrderStatus.CANCELLED)
        with pytest.raises(OrderAlreadyCancelled):
            CancelOrder(repository).execute(1)
        with engine.connect() as connection:
            assert connection.exec_driver_sql("SELECT id, status FROM orders").all() == [
                (1, "cancelled")
            ]
            connection.exec_driver_sql("UPDATE orders SET status = 'invalid' WHERE id = 1")
            connection.commit()
        with pytest.raises(ValueError):
            repository.get(1)
    finally:
        engine.dispose()
