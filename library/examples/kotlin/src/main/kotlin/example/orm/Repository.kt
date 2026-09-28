package example.orm

import example.application.OrderRepository
import example.domain.Order
import example.domain.OrderStatus
import org.jetbrains.exposed.v1.core.StdOutSqlLogger
import org.jetbrains.exposed.v1.core.dao.id.EntityID
import org.jetbrains.exposed.v1.core.dao.id.IntIdTable
import org.jetbrains.exposed.v1.dao.IntEntity
import org.jetbrains.exposed.v1.dao.IntEntityClass
import org.jetbrains.exposed.v1.jdbc.Database
import org.jetbrains.exposed.v1.jdbc.transactions.transaction

object OrderRows : IntIdTable("orders") {
    val status = text("status")
}

class OrderRow(id: EntityID<Int>) : IntEntity(id) {
    companion object : IntEntityClass<OrderRow>(OrderRows)
    var status by OrderRows.status
}

class ExposedOrderRepository(
    private val database: Database,
    private val logSql: Boolean = false,
) : OrderRepository {
    override fun get(orderId: Int): Order? = transaction(database) {
        if (logSql) addLogger(StdOutSqlLogger)
        OrderRow.findById(orderId)?.let { row ->
            val status = OrderStatus.entries.firstOrNull { it.value == row.status }
                ?: error("Unknown order status: ${row.status}")
            // Materialize the domain snapshot before leaving the transaction.
            Order(row.id.value, status)
        }
    }

    override fun save(order: Order) {
        transaction(database) {
            if (logSql) addLogger(StdOutSqlLogger)
            val row = OrderRow.findById(order.id)
            if (row == null) OrderRow.new(order.id) { status = order.status.value }
            else row.status = order.status.value
        }
    }
}
