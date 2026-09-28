package example.couplingcohesion.before

// Teaching artifact: the service reaches into the customer's fields to compute a discount,
// and the rule gets duplicated (and drifts) because nothing owns it but the service.

// The customer's properties are public because the service reaches straight into them.
data class Customer(val tier: String, val lifetimeSpend: Double, val yearsAsMember: Int)

data class Order(val amount: Double, val customer: Customer)

class OrderService {
    fun cancellationFee(order: Order): Double {
        // Feature envy: three of the customer's fields, read here instead of asked for.
        val customer = order.customer
        val discount = when {
            customer.tier == "gold" -> 0.25
            customer.lifetimeSpend >= 1000 -> 0.125
            customer.yearsAsMember >= 2 -> 0.0625
            else -> 0.0
        }
        return order.amount * (1 - discount)
    }

    fun loyaltyDiscount(customer: Customer): Double {
        // The same rule, copied for a receipt line — and it has drifted (`>` vs `>=`).
        return when {
            customer.tier == "gold" -> 0.25
            customer.lifetimeSpend > 1000 -> 0.125
            customer.yearsAsMember >= 2 -> 0.0625
            else -> 0.0
        }
    }
}
