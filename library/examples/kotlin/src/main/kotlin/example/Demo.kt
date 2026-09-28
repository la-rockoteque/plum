package example

import example.application.CancelOrder
import example.application.OrderRepository
import example.domain.Order
import example.domain.OrderStatus
import example.infrastructure.InMemoryOrderRepository
import example.infrastructure.SqliteOrderRepository
import example.infrastructure.initializeSchema
import java.sql.DriverManager
import kotlin.system.exitProcess

fun main(args: Array<String>) {
    // Composition root: only construction changes when selecting an adapter.
    when (args.singleOrNull()) {
        "memory" -> demonstrate(InMemoryOrderRepository())
        "sqlite" -> DriverManager.getConnection("jdbc:sqlite::memory:").use { connection ->
            initializeSchema(connection)
            demonstrate(SqliteOrderRepository(connection))
        }
        else -> {
            System.err.println("Usage: ./gradlew run --args='memory|sqlite'")
            exitProcess(1)
        }
    }
}

private fun demonstrate(repository: OrderRepository) {
    repository.save(Order(1))
    CancelOrder(repository).execute(1)
    val order = checkNotNull(repository.get(1))
    check(order.status == OrderStatus.CANCELLED)
    println("Order ${order.id}: ${order.status.value}")
}
