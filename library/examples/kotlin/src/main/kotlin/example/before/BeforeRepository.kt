package example.before

import java.sql.Connection

class CancelOrder(private val connection: Connection) {
    fun execute(orderId: Int) {
        // SQL, table/column names, and the business rule live together.
        // Tests need persistence; a storage change can force application changes.
        val status = connection.prepareStatement("SELECT status FROM orders WHERE id = ?").use {
            it.setInt(1, orderId)
            it.executeQuery().use { rows ->
                check(rows.next()) { "Order $orderId not found" }
                rows.getString("status")
            }
        }
        check(status != "cancelled") { "Order $orderId already cancelled" }
        connection.prepareStatement("UPDATE orders SET status = 'cancelled' WHERE id = ?").use {
            it.setInt(1, orderId)
            it.executeUpdate()
        }
    }
}
