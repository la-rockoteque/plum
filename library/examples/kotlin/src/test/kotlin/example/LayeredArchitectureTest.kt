package example

import example.layeredarchitecture.after.CancelOrder
import example.layeredarchitecture.after.CancelOrderUseCase
import example.layeredarchitecture.after.InMemoryOrderRepository
import example.layeredarchitecture.after.Order
import example.layeredarchitecture.after.OrderCannotBeCancelled
import example.layeredarchitecture.after.OrderNotFound
import example.layeredarchitecture.after.OrderStatus
import example.layeredarchitecture.after.SqliteOrderRepository
import example.layeredarchitecture.after.handleCancelRequest as handleAfterCancelRequest
import example.layeredarchitecture.after.initializeSchema
import example.layeredarchitecture.after.CancelRequest as AfterCancelRequest
import example.layeredarchitecture.after.CancelResponse as AfterCancelResponse
import example.layeredarchitecture.before.CancelRequest as BeforeCancelRequest
import example.layeredarchitecture.before.CancelResponse as BeforeCancelResponse
import example.layeredarchitecture.before.handleCancelRequest as handleBeforeCancelRequest
import java.sql.DriverManager
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class LayeredArchitectureTest {
    @Test
    fun `before - proving the cancellation rule requires a request and a database`() {
        DriverManager.getConnection("jdbc:sqlite::memory:").use { connection ->
            connection.createStatement().use {
                it.executeUpdate("CREATE TABLE orders (id INTEGER PRIMARY KEY, status TEXT)")
                it.executeUpdate("INSERT INTO orders VALUES (1, 'pending'), (2, 'shipped')")
            }

            assertEquals(
                BeforeCancelResponse("ok", "order 1 cancelled"),
                handleBeforeCancelRequest(BeforeCancelRequest("1"), connection),
            )
            connection.createStatement().use {
                it.executeQuery("SELECT status FROM orders WHERE id = 1").use { rows ->
                    rows.next()
                    assertEquals("cancelled", rows.getString("status"))
                }
            }

            // Proving the rule (a shipped order can't be cancelled) needs this same database.
            assertEquals("rejected", handleBeforeCancelRequest(BeforeCancelRequest("2"), connection).status)
            assertEquals("rejected", handleBeforeCancelRequest(BeforeCancelRequest("1"), connection).status)
            assertEquals("not_found", handleBeforeCancelRequest(BeforeCancelRequest("42"), connection).status)
            assertEquals("invalid", handleBeforeCancelRequest(BeforeCancelRequest("nope"), connection).status)
        }
    }

    @Test
    fun `after - the domain rule rejects a shipped order with no request or database`() {
        assertFailsWith<OrderCannotBeCancelled> { Order(1, OrderStatus.SHIPPED).cancel() }
    }

    @Test
    fun `after - the domain rule rejects a cancelled order with no request or database`() {
        assertFailsWith<OrderCannotBeCancelled> { Order(1, OrderStatus.CANCELLED).cancel() }
    }

    @Test
    fun `after - the domain rule cancels a pending order`() {
        val order = Order(1)
        order.cancel()
        assertEquals(OrderStatus.CANCELLED, order.status)
    }

    @Test
    fun `after - the application service cancels through an in-memory repository`() {
        val repository = InMemoryOrderRepository()
        repository.save(Order(1))
        CancelOrder(repository).execute(1)
        assertEquals(OrderStatus.CANCELLED, repository.get(1)?.status)

        assertFailsWith<OrderNotFound> { CancelOrder(repository).execute(42) }

        repository.save(Order(2, OrderStatus.SHIPPED))
        assertFailsWith<OrderCannotBeCancelled> { CancelOrder(repository).execute(2) }
    }

    private class FakeCancelOrder(private val error: Exception? = null) : CancelOrderUseCase {
        var calledWith: Int? = null

        override fun execute(orderId: Int) {
            calledWith = orderId
            error?.let { throw it }
        }
    }

    @Test
    fun `after - the handler cancels through a fake application service`() {
        val useCase = FakeCancelOrder()
        assertEquals(
            AfterCancelResponse("ok", "order 1 cancelled"),
            handleAfterCancelRequest(AfterCancelRequest("1"), useCase),
        )
        assertEquals(1, useCase.calledWith)

        assertEquals("invalid", handleAfterCancelRequest(AfterCancelRequest("nope"), FakeCancelOrder()).status)
        assertEquals(
            "not_found",
            handleAfterCancelRequest(AfterCancelRequest("1"), FakeCancelOrder(OrderNotFound(1))).status,
        )
        assertEquals(
            "rejected",
            handleAfterCancelRequest(
                AfterCancelRequest("1"),
                FakeCancelOrder(OrderCannotBeCancelled(1, OrderStatus.SHIPPED)),
            ).status,
        )
    }

    @Test
    fun `after - presentation, application, domain and data cancel an order on sqlite`() {
        DriverManager.getConnection("jdbc:sqlite::memory:").use { connection ->
            initializeSchema(connection)
            val repository = SqliteOrderRepository(connection)
            repository.save(Order(1))
            repository.save(Order(2, OrderStatus.SHIPPED))

            val useCase = CancelOrder(repository)
            assertEquals(
                AfterCancelResponse("ok", "order 1 cancelled"),
                handleAfterCancelRequest(AfterCancelRequest("1"), useCase),
            )
            assertEquals(OrderStatus.CANCELLED, repository.get(1)?.status)
            assertEquals("rejected", handleAfterCancelRequest(AfterCancelRequest("2"), useCase).status)
            assertEquals("not_found", handleAfterCancelRequest(AfterCancelRequest("42"), useCase).status)
            assertEquals("invalid", handleAfterCancelRequest(AfterCancelRequest("nope"), useCase).status)
        }
    }
}
