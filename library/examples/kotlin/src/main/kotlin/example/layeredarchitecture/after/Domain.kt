package example.layeredarchitecture.after

enum class OrderStatus(val value: String) {
    PENDING("pending"),
    SHIPPED("shipped"),
    CANCELLED("cancelled"),
}

class OrderCannotBeCancelled(id: Int, status: OrderStatus) :
    IllegalStateException("order $id already ${status.value}")

data class Order(val id: Int, var status: OrderStatus = OrderStatus.PENDING) {
    fun cancel() {
        if (status == OrderStatus.SHIPPED || status == OrderStatus.CANCELLED) {
            throw OrderCannotBeCancelled(id, status)
        }
        status = OrderStatus.CANCELLED
    }
}
