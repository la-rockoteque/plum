from repository_example.application.order_repository import OrderRepository


class OrderNotFound(Exception):
    pass


class CancelOrder:
    def __init__(self, repository: OrderRepository) -> None:
        self.repository = repository

    def execute(self, order_id: int) -> None:
        order = self.repository.get(order_id)
        if order is None:
            raise OrderNotFound(f"Order {order_id} not found")
        order.cancel()
        self.repository.save(order)
