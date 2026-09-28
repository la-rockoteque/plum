package example

import example.valueobjectsentities.after.CurrencyMismatch
import example.valueobjectsentities.after.InvalidStatusTransition
import example.valueobjectsentities.after.Money
import example.valueobjectsentities.after.Order
import example.valueobjectsentities.after.OrderStatus
import example.valueobjectsentities.before.Order as BeforeOrder
import example.valueobjectsentities.before.addTotals
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

class ValueObjectsEntitiesTest {
    @Test
    fun `before - an invalid status string is accepted`() {
        val order = BeforeOrder(id = 1, status = "pending", total = 9.99, currency = "USD")
        order.status = "definitely-not-a-status"
        assertEquals("definitely-not-a-status", order.status)
    }

    @Test
    fun `before - a cancelled order can be moved back to pending`() {
        val order = BeforeOrder(id = 1, status = "cancelled", total = 9.99, currency = "USD")
        order.status = "pending"
        assertEquals("pending", order.status)
    }

    @Test
    fun `before - totals in different currencies are added together`() {
        val usdOrder = BeforeOrder(id = 1, status = "pending", total = 10.0, currency = "USD")
        val eurOrder = BeforeOrder(id = 2, status = "pending", total = 5.0, currency = "EUR")
        assertEquals(15.0, addTotals(usdOrder, eurOrder))
    }

    @Test
    fun `before - repeated float amounts drift from the exact total`() {
        val orders = listOf(0, 1, 2).map { BeforeOrder(id = it, status = "pending", total = 0.1, currency = "USD") }
        val total = addTotals(orders[0], orders[1]) + orders[2].total
        assertNotEquals(0.3, total)
    }

    @Test
    fun `after - constructing an order with an unknown status is rejected`() {
        assertFailsWith<InvalidStatusTransition> { OrderStatus.parse("definitely-not-a-status") }
    }

    @Test
    fun `after - cancelling a cancelled order is rejected`() {
        val order = Order(id = 1, status = OrderStatus.PENDING, total = Money(999, "USD"))
        order.cancel()
        assertFailsWith<InvalidStatusTransition> { order.cancel() }
    }

    @Test
    fun `after - a cancelled order cannot move back to pending`() {
        val order = Order(id = 1, status = OrderStatus.PENDING, total = Money(999, "USD"))
        order.cancel()
        assertFailsWith<InvalidStatusTransition> { order.status.transitionTo(OrderStatus.PENDING) }
    }

    @Test
    fun `after - adding money in different currencies is rejected`() {
        assertFailsWith<CurrencyMismatch> { Money(1000, "USD").add(Money(500, "EUR")) }
    }

    @Test
    fun `after - repeated money amounts do not drift`() {
        val total = Money(10, "USD").add(Money(10, "USD")).add(Money(10, "USD"))
        assertEquals(Money(30, "USD"), total)
    }

    @Test
    fun `after - money with equal amount and currency is equal by value`() {
        assertEquals(Money(1000, "USD"), Money(1000, "USD"))
        assertNotEquals(Money(1000, "USD"), Money(1000, "EUR"))
    }

    @Test
    fun `after - money is immutable`() {
        val a = Money(1000, "USD")
        val b = Money(500, "USD")
        val c = a.add(b)
        assertEquals(Money(1000, "USD"), a)
        assertEquals(Money(1500, "USD"), c)
    }

    @Test
    fun `after - two orders with equal fields but different ids are not equal`() {
        val total = Money(500, "USD")
        val orderA = Order(id = 1, status = OrderStatus.PENDING, total = total)
        val orderB = Order(id = 2, status = OrderStatus.PENDING, total = total)
        assertTrue(orderA != orderB)

        val orderC = Order(id = 1, status = OrderStatus.PENDING, total = total)
        orderC.cancel()
        assertEquals(orderA, orderC)
    }
}
