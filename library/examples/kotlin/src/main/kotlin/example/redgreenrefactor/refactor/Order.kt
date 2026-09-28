package example.redgreenrefactor.refactor

enum class OrderStatus {
    PENDING,
    SHIPPED,
    CANCELLED,
}

// The rule, named and in one place instead of a string compare buried in cancel().
private val nonCancellableStatuses = setOf(OrderStatus.SHIPPED)

class Order(var status: OrderStatus = OrderStatus.PENDING) {
    fun canCancel(): Boolean = status !in nonCancellableStatuses

    fun cancel() {
        check(canCancel()) { "a shipped order can't be cancelled" }
        status = OrderStatus.CANCELLED
    }
}
