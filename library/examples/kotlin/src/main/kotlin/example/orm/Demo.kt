package example.orm

import example.application.CancelOrder
import example.application.OrderRepository
import example.domain.Order
import example.infrastructure.SqliteOrderRepository
import example.infrastructure.initializeSchema
import java.nio.file.Files
import java.sql.DriverManager
import org.jetbrains.exposed.v1.jdbc.Database
import org.jetbrains.exposed.v1.jdbc.SchemaUtils
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import kotlin.system.exitProcess

fun main(args: Array<String>) {
    val mode = args.singleOrNull()
    if (mode !in listOf("raw", "orm", "sql")) {
        System.err.println("Usage: ./gradlew ormDemo --args='raw|orm|sql'")
        exitProcess(1)
    }
    if (mode == "raw") {
        DriverManager.getConnection("jdbc:sqlite::memory:").use { connection ->
            initializeSchema(connection)
            demonstrate(SqliteOrderRepository(connection))
        }
    } else {
        // A file survives the separate JDBC connections opened by transactions.
        val file = Files.createTempFile("orm-example-", ".sqlite")
        try {
            val database = Database.connect("jdbc:sqlite:$file", driver = "org.sqlite.JDBC")
            try {
                transaction(database) { SchemaUtils.create(OrderRows) }
                demonstrate(ExposedOrderRepository(database, mode == "sql"))
            } finally {
                TransactionManager.closeAndUnregister(database)
            }
        } finally {
            Files.deleteIfExists(file)
        }
    }
}

private fun demonstrate(repository: OrderRepository) {
    repository.save(Order(1))
    CancelOrder(repository).execute(1)
    val order = checkNotNull(repository.get(1))
    println("Order ${order.id}: ${order.status.value}")
}
