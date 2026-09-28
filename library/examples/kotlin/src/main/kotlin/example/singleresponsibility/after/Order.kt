package example.singleresponsibility.after

enum class OrderStatus { PENDING, SHIPPED, CANCELLED }

data class Order(
    val id: Int,
    val customerName: String,
    val customerEmail: String,
    var status: OrderStatus = OrderStatus.PENDING,
)
