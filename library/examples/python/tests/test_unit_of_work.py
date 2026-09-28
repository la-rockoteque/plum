import pytest
from sqlalchemy import create_engine, text

from orm_example.repository import Base, SqlAlchemyOrderRepository
from repository_example.application.cancel_order import OrderNotFound
from repository_example.domain.order import Order, OrderAlreadyCancelled
from unit_of_work_example.batch import cancel_orders
from unit_of_work_example.demo import main


def test_demo_compares_partial_save_rollback_and_commit():
    main()


@pytest.mark.parametrize("ids,error", [([1, 404], OrderNotFound), ([1, 1], OrderAlreadyCancelled)])
def test_failure_rolls_back_flushed_write_and_next_unit_can_commit(ids, error):
    engine = create_engine("sqlite://")
    try:
        Base.metadata.create_all(engine)
        repository = SqlAlchemyOrderRepository(engine)
        for order_id in (1, 2):
            repository.save(Order(order_id))
        with pytest.raises(error):
            cancel_orders(engine, ids)
        with engine.connect() as connection:
            assert connection.execute(text("SELECT status FROM orders ORDER BY id")).scalars().all() == ["pending", "pending"]
        cancel_orders(engine, [1, 2])
        assert repository.get(1).status.value == "cancelled"
        assert repository.get(2).status.value == "cancelled"
    finally:
        engine.dispose()
