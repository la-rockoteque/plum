package example

import example.interfacesegregation.after.CancelOrder
import example.interfacesegregation.after.CancelOrderStore
import example.interfacesegregation.after.Order
import example.interfacesegregation.after.OrderArchiver
import example.interfacesegregation.after.OrderStoreAdapter
import example.interfacesegregation.before.CancelOrder as BeforeCancelOrder
import example.interfacesegregation.before.Order as BeforeOrder
import example.interfacesegregation.before.OrderStoreV1
import example.interfacesegregation.before.OrderStoreV2
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class InterfaceSegregationTest {
    // Implements the fat interface CancelOrder depends on. get/save are the only
    // methods CancelOrder calls; the rest exist only to satisfy the contract.
    private open class FakeOrderStoreV1(vararg initial: BeforeOrder) : OrderStoreV1 {
        val orders = mutableMapOf<Int, BeforeOrder>().apply { for (o in initial) put(o.id, o) }

        override fun get(orderId: Int): BeforeOrder = orders.getValue(orderId)

        override fun save(order: BeforeOrder) {
            orders[order.id] = order
        }

        override fun delete(orderId: Int): Nothing = error("not used")

        override fun listByCustomer(customerEmail: String): Nothing = error("not used")

        override fun exportCsv(): Nothing = error("not used")

        override fun auditTrail(orderId: Int): Nothing = error("not used")

        override fun purgeOlderThan(days: Int): Nothing = error("not used")

        companion object {
            val unusedStubs = listOf("delete", "listByCustomer", "exportCsv", "auditTrail", "purgeOlderThan")
        }
    }

    // The fat interface grew an eighth method (archive). CancelOrder's own behaviour
    // is unchanged, but its fake must grow with the interface -- one more unused stub.
    private class FakeOrderStoreV2(vararg initial: BeforeOrder) : FakeOrderStoreV1(*initial), OrderStoreV2 {
        override fun archive(orderId: Int): Nothing = error("not used")

        companion object {
            val unusedStubs = FakeOrderStoreV1.unusedStubs + "archive"
        }
    }

    @Test
    fun `before - cancel order works but its fake stubs five unused methods`() {
        val store = FakeOrderStoreV1(BeforeOrder(1, "ada@example.com", 500))
        BeforeCancelOrder(store).execute(1)
        assertEquals("cancelled", store.get(1).status)
        assertEquals(5, FakeOrderStoreV1.unusedStubs.size)
        assertFailsWith<IllegalStateException> { store.delete(1) }
    }

    @Test
    fun `before - growing the fat store forces the cancel test's fake to grow too`() {
        val store = FakeOrderStoreV2(BeforeOrder(1, "ada@example.com", 500))
        // Cancel order's own behaviour did not change -- it still only calls get and save.
        BeforeCancelOrder(store).execute(1)
        assertEquals("cancelled", store.get(1).status)
        // But the fake that satisfies the grown interface needed one more unused stub.
        assertEquals(FakeOrderStoreV1.unusedStubs.size + 1, FakeOrderStoreV2.unusedStubs.size)
        assertFailsWith<IllegalStateException> { store.archive(1) }
    }

    // Implements the narrow role interface CancelOrder actually depends on: exactly
    // two methods, both real.
    private class FakeCancelOrderStore(vararg initial: Order) : CancelOrderStore {
        private val orders = mutableMapOf<Int, Order>().apply { for (o in initial) put(o.id, o) }

        override fun get(orderId: Int): Order = orders.getValue(orderId)

        override fun save(order: Order) {
            orders[order.id] = order
        }

        companion object {
            val realMethods = listOf("get", "save")
        }
    }

    @Test
    fun `after - cancel order's fake has exactly two methods, both real`() {
        val store = FakeCancelOrderStore(Order(1, "ada@example.com", 500))
        CancelOrder(store).execute(1)
        assertEquals("cancelled", store.get(1).status)
        assertEquals(2, FakeCancelOrderStore.realMethods.size)
    }

    @Test
    fun `after - adding a role interface for archiving does not touch cancel order or its fake`() {
        val adapter = OrderStoreAdapter()
        adapter.save(Order(1, "ada@example.com", 500))
        val archiver: OrderArchiver = adapter
        archiver.archive(1)
        assertEquals("archived", adapter.get(1).status)
        // CancelOrder and its fake are exactly as declared above -- untouched by the new role.
        val store = FakeCancelOrderStore(Order(2, "ada@example.com", 700))
        CancelOrder(store).execute(2)
        assertEquals("cancelled", store.get(2).status)
        assertEquals(2, FakeCancelOrderStore.realMethods.size)
    }
}
