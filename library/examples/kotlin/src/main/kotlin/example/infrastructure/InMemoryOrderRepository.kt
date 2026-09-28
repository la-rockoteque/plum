package example.infrastructure

import example.application.OrderRepository
import example.domain.Order

class InMemoryOrderRepository : OrderRepository {
    private val orders = mutableMapOf<Int, Order>()

    override fun get(orderId: Int): Order? = orders[orderId]?.copy()

    override fun save(order: Order) {
        orders[order.id] = order.copy()
    }
}
