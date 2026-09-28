package example.uow

import example.application.OrderNotFound
import example.domain.Order
import example.domain.OrderStatus
import example.orm.OrderRow
import org.jetbrains.exposed.v1.jdbc.Database
import org.jetbrains.exposed.v1.jdbc.transactions.transaction

fun cancelOrders(database: Database, orderIds: List<Int>) {
    transaction(database) {
        maxAttempts = 1
        for (id in orderIds) {
            val row = OrderRow.findById(id) ?: throw OrderNotFound(id)
            val status = OrderStatus.entries.firstOrNull { it.value == row.status }
                ?: error("Unknown order status: ${row.status}")
            val order = Order(row.id.value, status)
            order.cancel()
            row.status = order.status.value
            row.flush() // Send SQL now; the enclosing transaction owns commit/rollback.
        }
    }
}
