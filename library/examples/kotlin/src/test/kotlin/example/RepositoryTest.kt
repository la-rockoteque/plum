package example

import example.application.OrderRepository
import example.before.CancelOrder as BeforeCancelOrder
import example.domain.Order
import example.domain.OrderStatus
import example.infrastructure.InMemoryOrderRepository
import example.infrastructure.SqliteOrderRepository
import example.infrastructure.initializeSchema
import java.sql.DriverManager
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNotNull
import kotlin.test.assertNull

class RepositoryTest {
    @Test
    fun memoryMeetsContract() {
        verifyContract(InMemoryOrderRepository())
    }

    @Test
    fun sqliteMeetsContract() {
        DriverManager.getConnection("jdbc:sqlite::memory:").use { connection ->
            initializeSchema(connection)
            verifyContract(SqliteOrderRepository(connection))
        }
    }

    private fun verifyContract(repository: OrderRepository) {
        assertNull(repository.get(42))
        val original = Order(1)
        repository.save(original)
        original.cancel()
        val loaded = assertNotNull(repository.get(1))
        assertEquals(Order(1), loaded)
        loaded.cancel()
        assertEquals(Order(1), repository.get(1))
        repository.save(loaded)
        assertEquals(Order(1, OrderStatus.CANCELLED), repository.get(1))
    }

    @Test
    fun coupledExampleNeedsDatabase() {
        DriverManager.getConnection("jdbc:sqlite::memory:").use { connection ->
            initializeSchema(connection)
            val repository = SqliteOrderRepository(connection)
            repository.save(Order(1))
            val cancel = BeforeCancelOrder(connection)
            cancel.execute(1)
            assertEquals(Order(1, OrderStatus.CANCELLED), repository.get(1))
            assertFailsWith<IllegalStateException> { cancel.execute(1) }
            assertFailsWith<IllegalStateException> { cancel.execute(42) }
            connection.createStatement().use {
                it.executeUpdate("UPDATE orders SET status = 'invalid' WHERE id = 1")
            }
            assertFailsWith<IllegalStateException> { repository.get(1) }
        }
    }
}
