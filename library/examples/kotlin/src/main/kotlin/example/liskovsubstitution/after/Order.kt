package example.liskovsubstitution.after

enum class OrderStatus { PENDING, SHIPPED, CANCELLED }

// The shape every order variant shares. Cancellation is not part of it:
// it's a separate capability below.
interface Order {
    val id: Int
    val status: OrderStatus
}

// The capability a caller actually needs: only order types that can honour
// it (pending -> cancelled, shipped/cancelled -> rejected) implement it.
interface CancellableOrder : Order {
    fun cancel(reason: String)
}

open class StandardOrder(override val id: Int, initialStatus: OrderStatus = OrderStatus.PENDING) : CancellableOrder {
    final override var status: OrderStatus = initialStatus
        private set

    override fun cancel(reason: String) {
        require(status != OrderStatus.SHIPPED && status != OrderStatus.CANCELLED) {
            "cannot cancel a shipped or cancelled order"
        }
        status = OrderStatus.CANCELLED
    }
}

// A second, independent type that satisfies CancellableOrder the same way
// StandardOrder does — proving the contract, not a single class, is what
// callers depend on.
class SubscriptionOrder(id: Int, initialStatus: OrderStatus = OrderStatus.PENDING) : StandardOrder(id, initialStatus)

// Shares Order's shape (id, status) but has no cancel() method: it does not
// implement CancellableOrder at all. The domain still considers it an
// order; the type system no longer lets it reach cancel().
class GiftOrder(override val id: Int, override val status: OrderStatus = OrderStatus.PENDING) : Order
