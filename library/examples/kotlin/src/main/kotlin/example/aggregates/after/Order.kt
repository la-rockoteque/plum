package example.aggregates.after

class OrderCancelledException(message: String) : Exception(message)
class InvalidQuantityException(message: String) : Exception(message)
class TooManyLinesException(message: String) : Exception(message)
class LineNotFoundException(message: String) : Exception(message)
class CurrencyMismatchException(message: String) : Exception(message)

private const val MAX_LINES = 10

enum class OrderStatus { PENDING, SHIPPED, CANCELLED }

// Held only inside the aggregate; callers only ever see copies of it.
data class OrderLine(
    val id: Int,
    val sku: String,
    var quantity: Int,
    val unitPriceMinor: Long,
)

// The aggregate root: the only entry point for reading or changing its lines.
class Order(val id: Int, private val currency: String = "USD", status: OrderStatus = OrderStatus.PENDING) {
    var status: OrderStatus = status
        private set

    private val linesInternal = mutableListOf<OrderLine>()
    private var nextLineId = 1

    // Returns copies: mutating the result can never change the aggregate's state.
    val lines: List<OrderLine>
        get() = linesInternal.map { it.copy() }

    // Always derived from the current lines — never a cache that can go stale.
    val totalMinor: Long
        get() = linesInternal.sumOf { it.quantity * it.unitPriceMinor }

    fun addLine(sku: String, quantity: Int, unitPriceMinor: Long, currency: String): Int {
        guard(quantity)
        if (currency != this.currency) throw CurrencyMismatchException("line currency $currency does not match order currency ${this.currency}")
        if (linesInternal.size >= MAX_LINES) throw TooManyLinesException("an order can have at most $MAX_LINES lines")
        val line = OrderLine(nextLineId, sku, quantity, unitPriceMinor)
        nextLineId += 1
        linesInternal.add(line)
        return line.id
    }

    fun changeQuantity(lineId: Int, quantity: Int) {
        guard(quantity)
        val line = linesInternal.find { it.id == lineId } ?: throw LineNotFoundException("no such line: $lineId")
        line.quantity = quantity
    }

    // Enforces the aggregate's own invariant: a shipped or already-cancelled order can't be cancelled.
    fun cancel() {
        if (status != OrderStatus.PENDING) throw OrderCancelledException("cannot cancel a shipped or already-cancelled order")
        status = OrderStatus.CANCELLED
    }

    // Detached copy: used by the repository so a stored order is never a live reference.
    fun copy(): Order {
        val clone = Order(id, currency, status)
        clone.linesInternal.addAll(lines)
        clone.nextLineId = nextLineId
        return clone
    }

    private fun guard(quantity: Int) {
        if (status == OrderStatus.CANCELLED) throw OrderCancelledException("cannot modify a cancelled order")
        if (quantity < 1) throw InvalidQuantityException("quantity must be at least 1")
    }
}

// One repository per aggregate: it saves and loads the whole Order, not individual lines.
class OrderRepository {
    private val orders = mutableMapOf<Int, Order>()

    fun save(order: Order) {
        orders[order.id] = order.copy()
    }

    fun get(orderId: Int): Order? = orders[orderId]?.copy()
}
