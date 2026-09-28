package example

import example.application.CancelOrder
import example.application.OrderNotFound
import example.domain.Order
import example.domain.OrderAlreadyCancelled
import example.domain.OrderStatus
import example.orm.ExposedOrderRepository
import example.orm.OrderRows
import java.nio.file.Files
import java.sql.DriverManager
import org.jetbrains.exposed.v1.jdbc.Database
import org.jetbrains.exposed.v1.jdbc.SchemaUtils
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNotNull
import kotlin.test.assertNull

class OrmTest {
    @Test
    fun exposedKeepsRepositoryContract() {
        val file = Files.createTempFile("orm-test-", ".sqlite")
        val url = "jdbc:sqlite:$file"
        try {
            val database = Database.connect(url, driver = "org.sqlite.JDBC")
            try {
                transaction(database) { SchemaUtils.create(OrderRows) }
                val repository = ExposedOrderRepository(database)
                assertNull(repository.get(42))
                assertFailsWith<OrderNotFound> { CancelOrder(repository).execute(42) }
                val original = Order(1)
                repository.save(original)
                original.cancel()
                val loaded = assertNotNull(repository.get(1))
                assertEquals(Order(1), loaded)
                loaded.cancel()
                assertEquals(Order(1), repository.get(1))
                CancelOrder(repository).execute(1)
                assertEquals(Order(1, OrderStatus.CANCELLED), repository.get(1))
                assertFailsWith<OrderAlreadyCancelled> { CancelOrder(repository).execute(1) }
                DriverManager.getConnection(url).use { connection ->
                    connection.createStatement().use { query ->
                        query.executeQuery("SELECT COUNT(*), MAX(status) FROM orders").use { rows ->
                            check(rows.next())
                            assertEquals(1, rows.getInt(1))
                            assertEquals("cancelled", rows.getString(2))
                        }
                        query.executeUpdate("UPDATE orders SET status = 'invalid' WHERE id = 1")
                    }
                }
                assertFailsWith<IllegalStateException> { repository.get(1) }
            } finally {
                TransactionManager.closeAndUnregister(database)
            }
        } finally {
            Files.deleteIfExists(file)
        }
    }
}
