package example

import example.aggregates.after.CurrencyMismatchException
import example.aggregates.after.InvalidQuantityException
import example.aggregates.after.Order
import example.aggregates.after.OrderCancelledException
import example.aggregates.after.OrderRepository
import example.aggregates.after.OrderStatus
import example.aggregates.after.TooManyLinesException
import example.aggregates.before.Order as BeforeOrder
import example.aggregates.before.OrderLine as BeforeOrderLine
import example.aggregates.before.OrderLineRepository
import example.aggregates.before.recomputeTotal
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNotNull

class AggregatesTest {
    @Test
    fun `before - adding a line does not update the cached total`() {
        val order = BeforeOrder(id = 1)
        val repo = OrderLineRepository()
        repo.add(BeforeOrderLine(id = 1, orderId = 1, sku = "WIDGET", quantity = 2, unitPriceMinor = 500, currency = "USD"))
        assertEquals(0, order.totalMinor)
    }

    @Test
    fun `before - an eleventh line is accepted`() {
        val repo = OrderLineRepository()
        for (i in 0 until 11) {
            repo.add(BeforeOrderLine(id = i, orderId = 1, sku = "SKU", quantity = 1, unitPriceMinor = 100, currency = "USD"))
        }
        assertEquals(11, repo.forOrder(1).size)
    }

    @Test
    fun `before - a lines quantity can be set to zero`() {
        val repo = OrderLineRepository()
        repo.add(BeforeOrderLine(id = 1, orderId = 1, sku = "WIDGET", quantity = 2, unitPriceMinor = 500, currency = "USD"))
        repo.updateQuantity(1, 0)
        assertEquals(0, repo.forOrder(1)[0].quantity)
    }

    @Test
    fun `before - a cancelled orders line can still be changed`() {
        val order = BeforeOrder(id = 1, status = "cancelled")
        val repo = OrderLineRepository()
        repo.add(BeforeOrderLine(id = 1, orderId = 1, sku = "WIDGET", quantity = 2, unitPriceMinor = 500, currency = "USD"))
        repo.updateQuantity(1, 5)
        assertEquals("cancelled", order.status)
        assertEquals(5, repo.forOrder(1)[0].quantity)
    }

    @Test
    fun `before - a line fetched from the repository can be mutated directly`() {
        val repo = OrderLineRepository()
        repo.add(BeforeOrderLine(id = 1, orderId = 1, sku = "WIDGET", quantity = 2, unitPriceMinor = 500, currency = "USD"))
        val fetched = repo.forOrder(1)[0]
        fetched.quantity = 99
        assertEquals(99, repo.forOrder(1)[0].quantity)
    }

    @Test
    fun `before - recomputeTotal must be called manually to stay correct`() {
        val order = BeforeOrder(id = 1)
        val repo = OrderLineRepository()
        repo.add(BeforeOrderLine(id = 1, orderId = 1, sku = "WIDGET", quantity = 2, unitPriceMinor = 500, currency = "USD"))
        recomputeTotal(order, repo.forOrder(1))
        assertEquals(1000, order.totalMinor)
        repo.updateQuantity(1, 5)
        assertEquals(1000, order.totalMinor)
    }

    @Test
    fun `after - adding a line updates the total immediately`() {
        val order = Order(id = 1)
        order.addLine("WIDGET", 2, 500, "USD")
        assertEquals(1000, order.totalMinor)
    }

    @Test
    fun `after - an eleventh line is rejected`() {
        val order = Order(id = 1)
        repeat(10) { order.addLine("SKU", 1, 100, "USD") }
        assertFailsWith<TooManyLinesException> { order.addLine("SKU", 1, 100, "USD") }
    }

    @Test
    fun `after - changing a lines quantity to zero is rejected`() {
        val order = Order(id = 1)
        val lineId = order.addLine("WIDGET", 2, 500, "USD")
        assertFailsWith<InvalidQuantityException> { order.changeQuantity(lineId, 0) }
    }

    @Test
    fun `after - changing a line on a cancelled order is rejected`() {
        val order = Order(id = 1)
        val lineId = order.addLine("WIDGET", 2, 500, "USD")
        order.cancel()
        assertFailsWith<OrderCancelledException> { order.changeQuantity(lineId, 3) }
    }

    @Test
    fun `after - cancelling a shipped or already cancelled order is rejected`() {
        val shipped = Order(id = 1, status = OrderStatus.SHIPPED)
        assertFailsWith<OrderCancelledException> { shipped.cancel() }

        val cancelled = Order(id = 2, status = OrderStatus.CANCELLED)
        assertFailsWith<OrderCancelledException> { cancelled.cancel() }
    }

    @Test
    fun `after - adding a line in another currency is rejected`() {
        val order = Order(id = 1, currency = "USD")
        assertFailsWith<CurrencyMismatchException> { order.addLine("WIDGET", 1, 500, "EUR") }
    }

    @Test
    fun `after - the lines returned by the order are copies that cannot mutate it`() {
        val order = Order(id = 1)
        order.addLine("WIDGET", 2, 500, "USD")
        val fetched = order.lines[0]
        fetched.quantity = 99
        assertEquals(2, order.lines[0].quantity)
        assertEquals(1000, order.totalMinor)
    }

    @Test
    fun `after - the repository saves and loads the whole order`() {
        val order = Order(id = 1)
        order.addLine("WIDGET", 2, 500, "USD")
        val repo = OrderRepository()
        repo.save(order)

        // Mutating the original after save must not reach the stored copy.
        order.addLine("GADGET", 1, 250, "USD")

        val loaded = repo.get(1)
        assertNotNull(loaded)
        assertEquals(1000, loaded.totalMinor)
        assertEquals(1, loaded.lines.size)

        // Mutating the loaded copy must not reach the stored order either.
        loaded.addLine("MUTATED", 1, 1, "USD")
        val again = repo.get(1)
        assertNotNull(again)
        assertEquals(1000, again.totalMinor)
    }
}
