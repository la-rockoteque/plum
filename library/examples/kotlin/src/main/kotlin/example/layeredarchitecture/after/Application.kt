package example.layeredarchitecture.after

// Port owned by the application layer. Data adapters implement it.
interface OrderRepository {
    fun get(orderId: Int): Order?
    fun save(order: Order)
}

class OrderNotFound(id: Int) : NoSuchElementException("order $id not found")

// Application service: loads the aggregate, calls domain behaviour, saves it.
class CancelOrder(private val repository: OrderRepository) : CancelOrderUseCase {
    override fun execute(orderId: Int) {
        val order = repository.get(orderId) ?: throw OrderNotFound(orderId)
        order.cancel()
        repository.save(order)
    }
}
