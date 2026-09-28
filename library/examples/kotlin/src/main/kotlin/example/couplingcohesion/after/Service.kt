package example.couplingcohesion.after

// Customer answers its own question - what loyalty discount do I get? OrderService only
// asks, through an interface, so it never cares which representation of Customer answers.

enum class LoyaltyTier { GOLD, SILVER, BRONZE }

// Satisfied by any Customer representation that can answer its own loyalty discount.
interface DiscountEligible {
    fun loyaltyDiscount(): Int
}

data class Customer(val tier: String, val lifetimeSpendMinor: Int, val yearsAsMember: Int) : DiscountEligible {
    // The one place that knows how tier, spend and membership translate into a discount.
    override fun loyaltyDiscount(): Int = when {
        tier == "gold" -> 2000
        lifetimeSpendMinor >= 100_000 -> 1000
        yearsAsMember >= 2 -> 500
        else -> 0
    }
}

// Asks the same question with a different internal shape - tier is the value type, not a
// string.
data class MigratedCustomer(val tier: LoyaltyTier, val lifetimeSpendMinor: Int, val yearsAsMember: Int) :
    DiscountEligible {
    override fun loyaltyDiscount(): Int = when {
        tier == LoyaltyTier.GOLD -> 2000
        lifetimeSpendMinor >= 100_000 -> 1000
        yearsAsMember >= 2 -> 500
        else -> 0
    }
}

data class Order(val amountMinor: Int, val customer: DiscountEligible)

class OrderService {
    fun cancellationFee(order: Order): Int {
        val discountBps = order.customer.loyaltyDiscount()
        return order.amountMinor * (10_000 - discountBps) / 10_000
    }

    fun loyaltyDiscount(customer: DiscountEligible): Int = customer.loyaltyDiscount()
}
