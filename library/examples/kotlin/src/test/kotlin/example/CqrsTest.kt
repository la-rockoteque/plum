package example

import example.application.CancelOrder
import example.application.OrderNotFound
import example.cqrs.GetOrderSummary
import example.cqrs.InMemoryOrderSummaryReader
import example.cqrs.OrderSummary
import example.cqrs.before.OrderService
import example.domain.Order
import example.domain.OrderAlreadyCancelled
import example.domain.OrderStatus
import example.infrastructure.InMemoryOrderRepository
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertIs
import kotlin.test.assertNull

class CqrsTest {
    @Test
    fun queriesAreSnapshotsAndCommandsKeepDomainRules() {
        val repository = InMemoryOrderRepository()
        repository.save(Order(1))
        val query = GetOrderSummary(InMemoryOrderSummaryReader(repository))
        val before = query.execute(1)
        assertEquals(OrderSummary(1, "pending", true), before)
        assertEquals(Order(1), repository.get(1))
        CancelOrder(repository).execute(1)
        assertEquals(OrderSummary(1, "cancelled", false), query.execute(1))
        assertEquals(OrderSummary(1, "pending", true), before)
        assertFailsWith<OrderAlreadyCancelled> { CancelOrder(repository).execute(1) }
        assertEquals(OrderSummary(1, "cancelled", false), query.execute(1))
    }

    @Test
    fun unknownQueryDoesNotCreateOrder() {
        val repository = InMemoryOrderRepository()
        val reader = InMemoryOrderSummaryReader(repository)
        assertNull(reader.getSummary(42))
        assertFailsWith<OrderNotFound> { GetOrderSummary(reader).execute(42) }
        assertNull(repository.get(42))
    }

    @Test
    fun beforeReturnsWriteModel() {
        val repository = InMemoryOrderRepository()
        repository.save(Order(1))
        val service = OrderService(repository)
        val order = service.cancelAndGet(1)
        assertIs<Order>(order)
        assertEquals(Order(1, OrderStatus.CANCELLED), repository.get(1))
        assertFailsWith<OrderAlreadyCancelled> { service.cancelAndGet(1) }
        assertFailsWith<OrderNotFound> { service.cancelAndGet(42) }
    }
}
