package example.interfacesegregation.after

class Order(val id: Int, val customerEmail: String, val amountMinor: Int) {
    var status: String = "pending"
}

// A role interface owned by CancelOrder: only what it needs, declared next to it.
interface CancelOrderStore {
    fun get(orderId: Int): Order
    fun save(order: Order)
}

// A separate role interface for a different client. CancelOrder never sees it.
interface OrderArchiver {
    fun archive(orderId: Int)
}

class CancelOrder(private val store: CancelOrderStore) {
    fun execute(orderId: Int) {
        val order = store.get(orderId)
        order.status = "cancelled"
        store.save(order)
    }
}

// The concrete adapter implements several role interfaces at once; CancelOrder only
// ever depends on the narrow one (CancelOrderStore).
class OrderStoreAdapter : CancelOrderStore, OrderArchiver {
    private val orders = mutableMapOf<Int, Order>()

    override fun get(orderId: Int): Order = orders.getValue(orderId)

    override fun save(order: Order) {
        orders[order.id] = order
    }

    override fun archive(orderId: Int) {
        get(orderId).status = "archived"
    }
}
