package example.couplingcohesion.before

// Teaching artifact: the service reaches into the customer's fields to compute a discount.
// When Customer's tier becomes a value type instead of a raw string, OrderService can't
// reuse its existing logic on the new shape - it needs a whole new method just to read it.

enum class LoyaltyTier { GOLD, SILVER, BRONZE }

// The customer's properties are public because the service reaches straight into them.
data class Customer(val tier: String, val lifetimeSpendMinor: Int, val yearsAsMember: Int)

// Same facts as Customer, after a migration - tier is now the value type, not a string.
data class MigratedCustomer(val tier: LoyaltyTier, val lifetimeSpendMinor: Int, val yearsAsMember: Int)

data class Order(val amountMinor: Int, val customer: Customer)

class OrderService {
    fun cancellationFee(order: Order): Int {
        // Feature envy: three of the customer's fields, read here instead of asked for.
        val customer = order.customer
        val discountBps = when {
            customer.tier == "gold" -> 2000
            customer.lifetimeSpendMinor >= 100_000 -> 1000
            customer.yearsAsMember >= 2 -> 500
            else -> 0
        }
        return order.amountMinor * (10_000 - discountBps) / 10_000
    }

    fun loyaltyDiscount(customer: Customer): Int {
        // The same interpretation, read again for a receipt line.
        return when {
            customer.tier == "gold" -> 2000
            customer.lifetimeSpendMinor >= 100_000 -> 1000
            customer.yearsAsMember >= 2 -> 500
            else -> 0
        }
    }

    // Exists only because Customer's tier became a value type - OrderService gained a whole
    // new method just to read it, because the interpretation lives here, not on Customer.
    fun migratedLoyaltyDiscount(customer: MigratedCustomer): Int = when {
        customer.tier == LoyaltyTier.GOLD -> 2000
        customer.lifetimeSpendMinor >= 100_000 -> 1000
        customer.yearsAsMember >= 2 -> 500
        else -> 0
    }
}
