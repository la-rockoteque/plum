from repository_example.application.cancel_order import OrderNotFound
from repository_example.application.order_repository import OrderRepository
from repository_example.domain.order import Order


class OrderService:
    def __init__(self, repository: OrderRepository) -> None:
        self.repository = repository

    def cancel_and_get(self, order_id: int) -> Order:
        # One operation changes state and returns the write model to the caller.
        order = self.repository.get(order_id)
        if order is None:
            raise OrderNotFound(f"Order {order_id} not found")
        order.cancel()
        self.repository.save(order)
        return order
