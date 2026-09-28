package example.aggregates.before

// A line entity with its own identity — nothing stops a caller reaching it directly.
data class OrderLine(
    val id: Int,
    val orderId: Int,
    val sku: String,
    var quantity: Int,
    val unitPriceMinor: Long,
    val currency: String,
)

// Lines get their own repository/collection, so callers can bypass the order entirely.
class OrderLineRepository {
    private val lines = mutableMapOf<Int, OrderLine>()

    fun add(line: OrderLine) {
        lines[line.id] = line
    }

    fun updateQuantity(lineId: Int, quantity: Int) {
        lines.getValue(lineId).quantity = quantity
    }

    fun remove(lineId: Int) {
        lines.remove(lineId)
    }

    fun forOrder(orderId: Int): List<OrderLine> = lines.values.filter { it.orderId == orderId }
}

// totalMinor is a cache: correct only if every caller remembers to refresh it.
data class Order(
    val id: Int,
    var status: String = "pending",
    var totalMinor: Long = 0,
    var currency: String = "USD",
)

// Refreshes the cached total from the current lines — easy to forget to call.
fun recomputeTotal(order: Order, lines: List<OrderLine>) {
    order.totalMinor = lines.sumOf { it.quantity * it.unitPriceMinor }
}
