package example.aggregates.after

class OrderCancelledException(message: String) : Exception(message)
class InvalidQuantityException(message: String) : Exception(message)
class TooManyLinesException(message: String) : Exception(message)
class LineNotFoundException(message: String) : Exception(message)

private const val MAX_LINES = 10

// Held only inside the aggregate; callers only ever see copies of it.
data class OrderLine(
    val id: Int,
    val sku: String,
    var quantity: Int,
    val unitPriceMinor: Long,
    val currency: String,
)

// The aggregate root: the only entry point for reading or changing its lines.
class Order(val id: Int, private val currency: String = "USD") {
    var status: String = "pending"
        private set

    private val linesInternal = mutableListOf<OrderLine>()
    private var nextLineId = 1

    // Returns copies: mutating the result can never change the aggregate's state.
    val lines: List<OrderLine>
        get() = linesInternal.map { it.copy() }

    // Always derived from the current lines — never a cache that can go stale.
    val totalMinor: Long
        get() = linesInternal.sumOf { it.quantity * it.unitPriceMinor }

    fun addLine(sku: String, quantity: Int, unitPriceMinor: Long): Int {
        guardNotCancelled()
        guardQuantity(quantity)
        if (linesInternal.size >= MAX_LINES) {
            throw TooManyLinesException("an order can have at most $MAX_LINES lines")
        }
        val line = OrderLine(nextLineId, sku, quantity, unitPriceMinor, currency)
        nextLineId += 1
        linesInternal.add(line)
        return line.id
    }

    fun changeQuantity(lineId: Int, quantity: Int) {
        guardNotCancelled()
        guardQuantity(quantity)
        find(lineId).quantity = quantity
    }

    fun removeLine(lineId: Int) {
        guardNotCancelled()
        linesInternal.remove(find(lineId))
    }

    fun cancel() {
        status = "cancelled"
    }

    private fun find(lineId: Int): OrderLine =
        linesInternal.find { it.id == lineId } ?: throw LineNotFoundException("no such line: $lineId")

    private fun guardNotCancelled() {
        if (status == "cancelled") {
            throw OrderCancelledException("cannot modify a cancelled order")
        }
    }

    private fun guardQuantity(quantity: Int) {
        if (quantity < 1) {
            throw InvalidQuantityException("quantity must be at least 1")
        }
    }
}

// One repository per aggregate: it saves and loads the whole Order, not individual lines.
class OrderRepository {
    private val orders = mutableMapOf<Int, Order>()

    fun save(order: Order) {
        orders[order.id] = order
    }

    fun get(orderId: Int): Order? = orders[orderId]
}
