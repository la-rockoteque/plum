package example

import example.application.CancelOrder
import example.application.OrderNotFound
import example.domain.Order
import example.domain.OrderAlreadyCancelled
import example.domain.OrderStatus
import example.infrastructure.InMemoryOrderRepository
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull

class CancelOrderTest {
    @Test
    fun cancelsPendingOrder() {
        val repository = InMemoryOrderRepository()
        repository.save(Order(1))
        CancelOrder(repository).execute(1)
        assertEquals(Order(1, OrderStatus.CANCELLED), repository.get(1))
    }

    @Test
    fun rejectsUnknownOrder() {
        val repository = InMemoryOrderRepository()
        assertFailsWith<OrderNotFound> { CancelOrder(repository).execute(1) }
        assertNull(repository.get(1))
    }

    @Test
    fun rejectsRepeatedCancellation() {
        val repository = InMemoryOrderRepository()
        repository.save(Order(1, OrderStatus.CANCELLED))
        assertFailsWith<OrderAlreadyCancelled> { CancelOrder(repository).execute(1) }
        assertEquals(Order(1, OrderStatus.CANCELLED), repository.get(1))
    }
}
