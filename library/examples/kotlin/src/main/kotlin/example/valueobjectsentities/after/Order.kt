package example.valueobjectsentities.after

class InvalidStatusTransition(message: String) : Exception(message)

// A value object: only these states exist, and only some moves between them are legal.
enum class OrderStatus {
    PENDING,
    CANCELLED;

    fun transitionTo(target: OrderStatus): OrderStatus {
        if (this == PENDING && target == CANCELLED) return target
        throw InvalidStatusTransition("Cannot move from $this to $target")
    }

    companion object {
        fun parse(value: String): OrderStatus = when (value) {
            "pending" -> PENDING
            "cancelled" -> CANCELLED
            else -> throw InvalidStatusTransition("Unknown order status: $value")
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
class Order(val id: Int, var status: OrderStatus, val total: Money) {
    fun cancel() {
        status = status.transitionTo(OrderStatus.CANCELLED)
    }

    override fun equals(other: Any?): Boolean = other is Order && id == other.id

    override fun hashCode(): Int = id.hashCode()
}
