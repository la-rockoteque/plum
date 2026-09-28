package example.valueobjectsentities.after

class InvalidStatusTransition(message: String) : Exception(message)

class UnknownStatus(message: String) : Exception(message)

// A value object: only these states exist, and only some moves between them are legal.
enum class OrderStatus {
    PENDING,
    SHIPPED,
    CANCELLED;

    fun transitionTo(target: OrderStatus): OrderStatus {
        if (this == PENDING && (target == SHIPPED || target == CANCELLED)) return target
        throw InvalidStatusTransition("Cannot move from $this to $target")
    }

    companion object {
        fun parse(value: String): OrderStatus = when (value) {
            "pending" -> PENDING
            "shipped" -> SHIPPED
            "cancelled" -> CANCELLED
            else -> throw UnknownStatus("Unknown order status: $value")
        }
    }
}

class CurrencyMismatch(message: String) : Exception(message)

// A value object: an immutable data class, compared by value, and blind to arithmetic across currencies.
data class Money(val amountMinor: Long, val currency: String) {
    fun add(other: Money): Money {
        if (other.currency != currency) {
            throw CurrencyMismatch("Cannot add ${other.currency} to $currency")
        }
        return Money(amountMinor + other.amountMinor, currency)
    }
}

// An entity: two Orders are the same order iff they share an id, whatever their attributes.
// status has a private setter: the only way to change it is ship()/cancel(), which enforce
// legal transitions. A caller outside the class can read it but can't reach in and reset it.
class Order(val id: Int, status: OrderStatus, val total: Money) {
    var status: OrderStatus = status
        private set

    fun ship() {
        status = status.transitionTo(OrderStatus.SHIPPED)
    }

    fun cancel() {
        status = status.transitionTo(OrderStatus.CANCELLED)
    }

    override fun equals(other: Any?): Boolean = other is Order && id == other.id

    override fun hashCode(): Int = id.hashCode()
}
