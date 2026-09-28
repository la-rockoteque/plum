package example.layeredarchitecture.before

import java.sql.Connection

data class CancelRequest(val orderId: String) // arrives as a string, as it would from a web request

data class CancelResponse(val status: String, val message: String) // "ok" | "invalid" | "not_found" | "rejected"

fun handleCancelRequest(request: CancelRequest, connection: Connection): CancelResponse {
    // Parsing, the cancellation rule, and SQL all live in one function: a rule change
    // and a column rename both force an edit here, and proving the rule needs a database.
    val orderId = request.orderId.toIntOrNull()
        ?: return CancelResponse("invalid", "order id must be a number")

    val status = connection.prepareStatement("SELECT status FROM orders WHERE id = ?").use {
        it.setInt(1, orderId)
        it.executeQuery().use { rows -> if (rows.next()) rows.getString("status") else null }
    } ?: return CancelResponse("not_found", "order $orderId not found")

    if (status == "shipped" || status == "cancelled") {
        return CancelResponse("rejected", "order $orderId already $status")
    }
    connection.prepareStatement("UPDATE orders SET status = 'cancelled' WHERE id = ?").use {
        it.setInt(1, orderId)
        it.executeUpdate()
    }
    return CancelResponse("ok", "order $orderId cancelled")
}
