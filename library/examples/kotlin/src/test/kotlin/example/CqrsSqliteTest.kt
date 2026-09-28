package example

import example.application.CancelOrder
import example.application.OrderNotFound
import example.cqrs.GetOrderSummary
import example.cqrs.OrderSummary
import example.cqrs.SqliteOrderSummaryReader
import example.domain.Order
import example.infrastructure.SqliteOrderRepository
import example.infrastructure.initializeSchema
import java.sql.DriverManager
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull

class CqrsSqliteTest {
    @Test
    fun readAndWriteModelsShareOneDatabase() {
        DriverManager.getConnection("jdbc:sqlite::memory:").use { connection ->
            initializeSchema(connection)
            val repository = SqliteOrderRepository(connection)
            val reader = SqliteOrderSummaryReader(connection)
            val query = GetOrderSummary(reader)
            assertNull(reader.getSummary(42))
            assertFailsWith<OrderNotFound> { query.execute(42) }
            repository.save(Order(1))
            val before = query.execute(1)
            assertEquals(OrderSummary(1, "pending", true), before)
            assertEquals(Order(1), repository.get(1))
            CancelOrder(repository).execute(1)
            assertEquals(OrderSummary(1, "cancelled", false), query.execute(1))
            assertEquals(OrderSummary(1, "pending", true), before)
        }
    }
}
