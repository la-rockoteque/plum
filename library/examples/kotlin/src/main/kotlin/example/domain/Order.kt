package example.domain

enum class OrderStatus(val value: String) {
    PENDING("pending"),
    CANCELLED("cancelled"),
}

class OrderAlreadyCancelled(id: Int) : IllegalStateException("Order $id already cancelled")

data class Order(val id: Int, var status: OrderStatus = OrderStatus.PENDING) {
    fun cancel() {
        if (status == OrderStatus.CANCELLED) throw OrderAlreadyCancelled(id)
        status = OrderStatus.CANCELLED
    }
}
