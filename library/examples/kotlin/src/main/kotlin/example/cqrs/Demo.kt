package example.cqrs

import example.application.CancelOrder
import example.application.OrderRepository
import example.cqrs.before.OrderService
import example.domain.Order
import example.infrastructure.InMemoryOrderRepository
import example.infrastructure.SqliteOrderRepository
import example.infrastructure.initializeSchema
import java.sql.DriverManager
import kotlin.system.exitProcess

fun main(args: Array<String>) {
    when (args.singleOrNull()) {
        "before" -> {
            val repository = InMemoryOrderRepository()
            repository.save(Order(1))
            val order = OrderService(repository).cancelAndGet(1)
            println("Order ${order.id}: ${order.status.value}")
        }
        "memory" -> {
            val repository = InMemoryOrderRepository()
            demonstrate(repository, InMemoryOrderSummaryReader(repository))
        }
        "sqlite" -> DriverManager.getConnection("jdbc:sqlite::memory:").use { connection ->
            initializeSchema(connection)
            demonstrate(SqliteOrderRepository(connection), SqliteOrderSummaryReader(connection))
        }
        else -> {
            System.err.println("Usage: ./gradlew cqrsDemo --args='before|memory|sqlite'")
            exitProcess(1)
        }
    }
}

private fun demonstrate(repository: OrderRepository, reader: OrderSummaryReader) {
    repository.save(Order(1))
    val query = GetOrderSummary(reader)
    val before = query.execute(1)
    CancelOrder(repository).execute(1)
    val after = query.execute(1)
    println("Before: ${before.status}, can_cancel=${before.canCancel}")
    println("After: ${after.status}, can_cancel=${after.canCancel}")
}
