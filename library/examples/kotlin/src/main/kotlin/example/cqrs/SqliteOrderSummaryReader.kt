package example.cqrs

import java.sql.Connection

class SqliteOrderSummaryReader(private val connection: Connection) : OrderSummaryReader {
    override fun getSummary(orderId: Int): OrderSummary? {
        // Project straight into display data; don't load a domain entity.
        return connection.prepareStatement(
            "SELECT id, status, status = 'pending' AS can_cancel FROM orders WHERE id = ?"
        ).use { query ->
            query.setInt(1, orderId)
            query.executeQuery().use { rows ->
                if (!rows.next()) null else OrderSummary(
                    rows.getInt("id"), rows.getString("status"), rows.getBoolean("can_cancel")
                )
            }
        }
    }
}
