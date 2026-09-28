package example.couplingcohesion.after

// The customer owns the question "what discount do I get?"; the service only asks it.

data class Customer(val tier: String, val lifetimeSpend: Double, val yearsAsMember: Int) {
    // The one place that knows how tier, spend and membership translate into a discount.
    fun cancellationDiscount(): Double = when {
        tier == "gold" -> 0.25
        lifetimeSpend >= 1000 -> 0.125
        yearsAsMember >= 2 -> 0.0625
        else -> 0.0
    }
}

data class Order(val amount: Double, val customer: Customer)

class OrderService {
    fun cancellationFee(order: Order): Double =
        order.amount * (1 - order.customer.cancellationDiscount())

    fun loyaltyDiscount(customer: Customer): Double = customer.cancellationDiscount()
}
