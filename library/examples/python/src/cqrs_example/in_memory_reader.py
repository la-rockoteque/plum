from cqrs_example.queries import OrderSummary
from repository_example.domain.order import OrderStatus
from repository_example.infrastructure.in_memory_order_repository import (
    InMemoryOrderRepository,
)


class InMemoryOrderSummaryReader:
    def __init__(self, repository: InMemoryOrderRepository) -> None:
        self.repository = repository

    def get_summary(self, order_id: int) -> OrderSummary | None:
        order = self.repository.get(order_id)
        if order is None:
            return None
        return OrderSummary(order.id, order.status.value, order.status == OrderStatus.PENDING)
