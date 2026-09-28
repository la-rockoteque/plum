package example

import example.application.OrderNotFound
import example.domain.Order
import example.domain.OrderAlreadyCancelled
import example.domain.OrderStatus
import example.orm.ExposedOrderRepository
import example.orm.OrderRows
import example.uow.cancelOrders
import java.nio.file.Files
import org.jetbrains.exposed.v1.jdbc.Database
import org.jetbrains.exposed.v1.jdbc.SchemaUtils
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class UnitOfWorkTest {
    @Test
    fun demoComparesPartialSaveRollbackAndCommit() = example.uow.main()

    @Test
    fun failureRollsBackFlushedWritesAndNextUnitCanCommit() {
        val file = Files.createTempFile("uow-test-", ".sqlite")
        try {
            val database = Database.connect("jdbc:sqlite:$file", driver = "org.sqlite.JDBC")
            try {
                transaction(database) { SchemaUtils.create(OrderRows) }
                val repository = ExposedOrderRepository(database)
                repository.save(Order(1))
                repository.save(Order(2))
                assertFailsWith<OrderNotFound> { cancelOrders(database, listOf(1, 404)) }
                assertEquals(Order(1), repository.get(1))
                assertEquals(Order(2), repository.get(2))
                assertFailsWith<OrderAlreadyCancelled> { cancelOrders(database, listOf(1, 1)) }
                assertEquals(Order(1), repository.get(1))
                cancelOrders(database, listOf(1, 2))
                assertEquals(Order(1, OrderStatus.CANCELLED), repository.get(1))
                assertEquals(Order(2, OrderStatus.CANCELLED), repository.get(2))
            } finally {
                TransactionManager.closeAndUnregister(database)
            }
        } finally {
            Files.deleteIfExists(file)
        }
    }
}
