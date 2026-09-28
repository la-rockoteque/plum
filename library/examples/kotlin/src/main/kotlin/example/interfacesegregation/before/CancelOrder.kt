package example.interfacesegregation.before

class Order(val id: Int, val customerEmail: String, val amountMinor: Int) {
    var status: String = "pending"
}

// The only persistence contract available. CancelOrder depends on all seven methods
// below even though it only ever calls two of them.
interface OrderStoreV1 {
    fun get(orderId: Int): Order
    fun save(order: Order)
    fun delete(orderId: Int)
    fun listByCustomer(customerEmail: String): List<Order>
    fun exportCsv(): String
    fun auditTrail(orderId: Int): List<String>
    fun purgeOlderThan(days: Int): Int
}

// The fat interface grows an eighth method. Every implementer -- including a fake
// written for a use case that never touches archiving -- must grow with it.
interface OrderStoreV2 : OrderStoreV1 {
    fun archive(orderId: Int)
}

// Depends on the whole fat interface, though it only ever calls get and save.
class CancelOrder(private val store: OrderStoreV1) {
    fun execute(orderId: Int) {
        val order = store.get(orderId)
        order.status = "cancelled"
        store.save(order)
    }
}
