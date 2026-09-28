package example.characterizationtests.legacy

data class Order(
    val orderId: Long,
    val amountMinor: Long,
    val purchasedAtMs: Long,
    val status: String,
)

// Nobody who still works here wrote this. It has never had a test.
fun computeRefund(order: Order, todayMs: Long): Long {
    if (order.status == "hold") {
        return 0
    } else {
        val ageDays = (todayMs - order.purchasedAtMs) / 86400000
        val refund: Long
        if (ageDays <= 14) {
            refund = order.amountMinor
        } else {
            refund = (order.amountMinor * 90) / 100
        }
        if (ageDays > 30) {
            return (refund / 100) * 100
        } else {
            return refund
        }
    }
}
