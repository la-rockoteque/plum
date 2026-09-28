package example

import example.couplingcohesion.after.Customer as AfterCustomer
import example.couplingcohesion.after.LoyaltyTier as AfterLoyaltyTier
import example.couplingcohesion.after.MigratedCustomer as AfterMigratedCustomer
import example.couplingcohesion.after.Order as AfterOrder
import example.couplingcohesion.after.OrderService as AfterOrderService
import example.couplingcohesion.before.Customer as BeforeCustomer
import example.couplingcohesion.before.LoyaltyTier as BeforeLoyaltyTier
import example.couplingcohesion.before.MigratedCustomer as BeforeMigratedCustomer
import example.couplingcohesion.before.Order as BeforeOrder
import example.couplingcohesion.before.OrderService as BeforeOrderService
import kotlin.test.Test
import kotlin.test.assertEquals

class CouplingCohesionTest {
    @Test
    fun `before - cancellation fee and loyalty discount read the customers fields directly`() {
        val gold = BeforeCustomer(tier = "gold", lifetimeSpendMinor = 50_000, yearsAsMember = 1)
        val order = BeforeOrder(amountMinor = 10_000, customer = gold)
        val service = BeforeOrderService()
        assertEquals(8_000, service.cancellationFee(order))
        assertEquals(2000, service.loyaltyDiscount(gold))

        val bigSpender = BeforeCustomer(tier = "bronze", lifetimeSpendMinor = 150_000, yearsAsMember = 0)
        assertEquals(1000, service.loyaltyDiscount(bigSpender))
    }

    @Test
    fun `before - a migrated customer representation needs its own order service method`() {
        val migrated = BeforeMigratedCustomer(tier = BeforeLoyaltyTier.GOLD, lifetimeSpendMinor = 50_000, yearsAsMember = 1)
        val service = BeforeOrderService()
        // Customer's tier became a value type; OrderService had to gain a whole new method to
        // read it - the change cost of reaching into Customer's representation instead of asking.
        assertEquals(2000, service.migratedLoyaltyDiscount(migrated))
    }

    @Test
    fun `after - cancellation fee asks the customer for its own discount`() {
        val gold = AfterCustomer(tier = "gold", lifetimeSpendMinor = 50_000, yearsAsMember = 1)
        val order = AfterOrder(amountMinor = 10_000, customer = gold)
        val service = AfterOrderService()
        assertEquals(8_000, service.cancellationFee(order))
        assertEquals(2000, service.loyaltyDiscount(gold))

        val bigSpender = AfterCustomer(tier = "bronze", lifetimeSpendMinor = 150_000, yearsAsMember = 0)
        assertEquals(1000, service.loyaltyDiscount(bigSpender))
    }

    @Test
    fun `after - order service needs no changes for a migrated customer representation`() {
        val migrated = AfterMigratedCustomer(tier = AfterLoyaltyTier.GOLD, lifetimeSpendMinor = 50_000, yearsAsMember = 1)
        val order = AfterOrder(amountMinor = 10_000, customer = migrated)
        val service = AfterOrderService()
        // Same OrderService code, unedited, gives the same answer for the new representation.
        assertEquals(8_000, service.cancellationFee(order))
        assertEquals(2000, service.loyaltyDiscount(migrated))
    }
}
