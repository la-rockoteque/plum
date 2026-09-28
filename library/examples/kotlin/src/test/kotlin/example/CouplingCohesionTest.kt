package example

import example.couplingcohesion.after.Customer as AfterCustomer
import example.couplingcohesion.after.Order as AfterOrder
import example.couplingcohesion.after.OrderService as AfterOrderService
import example.couplingcohesion.before.Customer as BeforeCustomer
import example.couplingcohesion.before.Order as BeforeOrder
import example.couplingcohesion.before.OrderService as BeforeOrderService
import kotlin.test.Test
import kotlin.test.assertEquals

class CouplingCohesionTest {
    @Test
    fun `before - cancellation fee reads the customers tier and spend directly`() {
        val customer = BeforeCustomer(tier = "gold", lifetimeSpend = 500.0, yearsAsMember = 1)
        val order = BeforeOrder(amount = 100.0, customer = customer)
        val service = BeforeOrderService()
        assertEquals(75.0, service.cancellationFee(order))
        assertEquals(0.25, service.loyaltyDiscount(customer))
    }

    @Test
    fun `before - cancellation fee and loyalty discount disagree at the spend boundary`() {
        val customer = BeforeCustomer(tier = "bronze", lifetimeSpend = 1000.0, yearsAsMember = 0)
        val order = BeforeOrder(amount = 200.0, customer = customer)
        val service = BeforeOrderService()
        assertEquals(175.0, service.cancellationFee(order)) // 12.5% discount applied
        assertEquals(0.0, service.loyaltyDiscount(customer)) // same customer, no discount at all
    }

    @Test
    fun `after - cancellation fee asks the customer for its own discount`() {
        val customer = AfterCustomer(tier = "gold", lifetimeSpend = 500.0, yearsAsMember = 1)
        val order = AfterOrder(amount = 100.0, customer = customer)
        val service = AfterOrderService()
        assertEquals(75.0, service.cancellationFee(order))
        assertEquals(0.25, service.loyaltyDiscount(customer))
    }

    @Test
    fun `after - cancellation fee and loyalty discount agree at the spend boundary`() {
        val customer = AfterCustomer(tier = "bronze", lifetimeSpend = 1000.0, yearsAsMember = 0)
        val order = AfterOrder(amount = 200.0, customer = customer)
        val service = AfterOrderService()
        assertEquals(175.0, service.cancellationFee(order))
        assertEquals(0.125, service.loyaltyDiscount(customer))
    }
}
