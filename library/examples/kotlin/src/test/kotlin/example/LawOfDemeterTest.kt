package example

import example.lawofdemeter.after.Address as AfterAddress
import example.lawofdemeter.after.CancellationPolicy as AfterCancellationPolicy
import example.lawofdemeter.after.Card as AfterCard
import example.lawofdemeter.after.Country as AfterCountry
import example.lawofdemeter.after.Customer as AfterCustomer
import example.lawofdemeter.after.Order as AfterOrder
import example.lawofdemeter.after.Wallet as AfterWallet
import example.lawofdemeter.before.Address as BeforeAddress
import example.lawofdemeter.before.CancellationPolicy as BeforeCancellationPolicy
import example.lawofdemeter.before.Card as BeforeCard
import example.lawofdemeter.before.Country as BeforeCountry
import example.lawofdemeter.before.Customer as BeforeCustomer
import example.lawofdemeter.before.Order as BeforeOrder
import example.lawofdemeter.before.Wallet as BeforeWallet
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class LawOfDemeterTest {
    @Test
    fun `before - shipping and refund decisions walk the customers address and wallet directly`() {
        val policy = BeforeCancellationPolicy()

        val domestic = BeforeOrder(
            BeforeCustomer(
                address = BeforeAddress(country = BeforeCountry(code = "US")),
                wallet = BeforeWallet(card = BeforeCard(expired = false)),
            )
        )
        assertEquals(true, policy.shipsDomestically(domestic))
        assertEquals(true, policy.canAutoRefund(domestic))

        val foreign = BeforeOrder(
            BeforeCustomer(
                address = BeforeAddress(country = BeforeCountry(code = "CA")),
                wallet = BeforeWallet(card = BeforeCard(expired = true)),
            )
        )
        assertEquals(false, policy.shipsDomestically(foreign))
        assertEquals(false, policy.canAutoRefund(foreign))
    }

    @Test
    fun `before - a pickup point address without a country breaks the shipping check`() {
        val policy = BeforeCancellationPolicy()
        val order = BeforeOrder(
            BeforeCustomer(
                address = BeforeAddress(country = null),
                wallet = BeforeWallet(card = BeforeCard(expired = false)),
            )
        )
        assertFailsWith<NullPointerException> { policy.shipsDomestically(order) }
    }

    @Test
    fun `after - order asks its customer who asks its own collaborators for the same decisions`() {
        val policy = AfterCancellationPolicy()

        val domestic = AfterOrder(
            AfterCustomer(
                address = AfterAddress(country = AfterCountry(code = "US")),
                wallet = AfterWallet(card = AfterCard(expired = false)),
            )
        )
        assertEquals(true, policy.shipsDomestically(domestic))
        assertEquals(true, policy.canAutoRefund(domestic))

        val foreign = AfterOrder(
            AfterCustomer(
                address = AfterAddress(country = AfterCountry(code = "CA")),
                wallet = AfterWallet(card = AfterCard(expired = true)),
            )
        )
        assertEquals(false, policy.shipsDomestically(foreign))
        assertEquals(false, policy.canAutoRefund(foreign))
    }

    @Test
    fun `after - a pickup point address without a country no longer breaks the shipping check`() {
        val policy = AfterCancellationPolicy()
        val order = AfterOrder(
            AfterCustomer(
                address = AfterAddress(country = null),
                wallet = AfterWallet(card = AfterCard(expired = false)),
            )
        )
        assertEquals(false, policy.shipsDomestically(order))
        assertEquals(true, policy.canAutoRefund(order))
    }
}
