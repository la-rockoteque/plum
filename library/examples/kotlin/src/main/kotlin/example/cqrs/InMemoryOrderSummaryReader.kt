package example.cqrs

import example.domain.OrderStatus
import example.infrastructure.InMemoryOrderRepository

class InMemoryOrderSummaryReader(private val repository: InMemoryOrderRepository) : OrderSummaryReader {
    override fun getSummary(orderId: Int): OrderSummary? = repository.get(orderId)?.let {
        OrderSummary(it.id, it.status.value, it.status == OrderStatus.PENDING)
    }
}
