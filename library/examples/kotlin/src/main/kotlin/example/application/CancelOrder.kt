package example.application

class OrderNotFound(id: Int) : NoSuchElementException("Order $id not found")

class CancelOrder(private val repository: OrderRepository) {
    fun execute(orderId: Int) {
        val order = repository.get(orderId) ?: throw OrderNotFound(orderId)
        order.cancel()
        repository.save(order)
    }
}
