package example.application

import example.domain.Order

// get returns a detached entity; save inserts or updates by ID.
interface OrderRepository {
    fun get(orderId: Int): Order?
    fun save(order: Order)
}
