package example.liskovsubstitution.before

enum class OrderStatus { PENDING, SHIPPED, CANCELLED }

open class Order(val id: Int, status: OrderStatus = OrderStatus.PENDING) {
    var status: OrderStatus = status
        protected set

    open fun cancel(reason: String) {
        require(status != OrderStatus.SHIPPED && status != OrderStatus.CANCELLED) {
            "cannot cancel a shipped or cancelled order"
        }
        status = OrderStatus.CANCELLED
    }
}

// Strengthens Order's precondition: cancel() rejects every request, even
// while pending, where the base class would accept it. A caller that only
// knows the Order contract can no longer assume cancelling a pending order
// succeeds.
class GiftOrder(id: Int, status: OrderStatus = OrderStatus.PENDING) : Order(id, status) {
    override fun cancel(reason: String) {
        throw IllegalArgumentException("gift orders can't be cancelled online")
    }
}
