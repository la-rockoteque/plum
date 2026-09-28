package example.uow

import example.application.CancelOrder
import example.application.OrderNotFound
import example.domain.Order
import example.orm.ExposedOrderRepository
import example.orm.OrderRows
import java.nio.file.Files
import java.sql.DriverManager
import org.jetbrains.exposed.v1.jdbc.Database
import org.jetbrains.exposed.v1.jdbc.SchemaUtils
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import org.jetbrains.exposed.v1.jdbc.transactions.transaction

fun main() {
    val file = Files.createTempFile("uow-demo-", ".sqlite")
    val url = "jdbc:sqlite:$file"
    try {
        val database = Database.connect(url, driver = "org.sqlite.JDBC")
        try {
            transaction(database) { SchemaUtils.create(OrderRows) }
            val repository = ExposedOrderRepository(database)
            for (mode in listOf("before", "rollback", "commit")) {
                repository.save(Order(1))
                repository.save(Order(2))
                val ids = if (mode == "commit") listOf(1, 2) else listOf(1, 404)
                try {
                    if (mode == "before") ids.forEach { CancelOrder(repository).execute(it) }
                    else cancelOrders(database, ids)
                } catch (error: OrderNotFound) {
                    if (mode == "commit") throw error
                }
                val statuses = DriverManager.getConnection(url).use { connection ->
                    connection.createStatement().use { query ->
                        query.executeQuery("SELECT status FROM orders ORDER BY id").use { rows ->
                            buildList { while (rows.next()) add(rows.getString(1)) }
                        }
                    }
                }
                val expected = when (mode) {
                    "before" -> listOf("cancelled", "pending")
                    "rollback" -> listOf("pending", "pending")
                    else -> listOf("cancelled", "cancelled")
                }
                check(statuses == expected)
                println("$mode: ${statuses.joinToString(", ")}")
            }
        } finally {
            TransactionManager.closeAndUnregister(database)
        }
    } finally {
        Files.deleteIfExists(file)
    }
}
