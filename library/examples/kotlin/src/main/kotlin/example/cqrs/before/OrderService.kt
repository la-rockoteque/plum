package example.cqrs.before

import example.application.OrderNotFound
import example.application.OrderRepository
import example.domain.Order

class OrderService(private val repository: OrderRepository) {
    fun cancelAndGet(orderId: Int): Order {
        // One operation changes state and returns the write model to the caller.
        val order = repository.get(orderId) ?: throw OrderNotFound(orderId)
        order.cancel()
        repository.save(order)
        return order
    }
}
