package example.layeredarchitecture.after

import java.sql.Connection

// Data-layer adapter for tests and demos: same contract, no database.
class InMemoryOrderRepository : OrderRepository {
    private val orders = mutableMapOf<Int, Order>()

    override fun get(orderId: Int): Order? = orders[orderId]?.copy()

    override fun save(order: Order) {
        orders[order.id] = order.copy()
    }
}

fun initializeSchema(connection: Connection) {
    connection.createStatement().use {
        it.executeUpdate(
            "CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY, status TEXT NOT NULL)"
        )
    }
}

// Data-layer adapter over SQLite. Caller owns the connection.
class SqliteOrderRepository(private val connection: Connection) : OrderRepository {
    override fun get(orderId: Int): Order? =
        connection.prepareStatement("SELECT id, status FROM orders WHERE id = ?").use { query ->
            query.setInt(1, orderId)
            query.executeQuery().use { rows ->
                if (!rows.next()) null else {
                    val storedStatus = rows.getString("status")
                    val status = OrderStatus.entries.firstOrNull { it.value == storedStatus }
                        ?: error("Unknown order status: $storedStatus")
                    Order(rows.getInt("id"), status)
                }
            }
        }

    override fun save(order: Order) {
        connection.prepareStatement(
            "INSERT INTO orders (id, status) VALUES (?, ?) " +
                "ON CONFLICT(id) DO UPDATE SET status = excluded.status"
        ).use { command ->
            command.setInt(1, order.id)
            command.setString(2, order.status.value)
            command.executeUpdate()
        }
    }
}
