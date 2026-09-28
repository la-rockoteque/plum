package example.valueobjectsentities.before

// An order built from bare primitives: status and total carry no rules of their own.
data class Order(
    val id: Int,
    var status: String = "pending",
    var total: Double = 0.0,
    var currency: String = "USD",
)

// Adds two orders' totals. Nothing here notices the currencies might differ.
fun addTotals(a: Order, b: Order): Double = a.total + b.total
