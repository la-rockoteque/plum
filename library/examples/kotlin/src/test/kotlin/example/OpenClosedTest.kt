package example

import example.openclosed.after.CancellationFeeCalculator as AfterCalculator
import example.openclosed.after.CUSTOM_MADE as AFTER_CUSTOM_MADE
import example.openclosed.after.defaultPolicies
import example.openclosed.after.EXPRESS as AFTER_EXPRESS
import example.openclosed.after.FeePolicy
import example.openclosed.after.Order as AfterOrder
import example.openclosed.after.STANDARD as AFTER_STANDARD
import example.openclosed.after.SUBSCRIPTION as AFTER_SUBSCRIPTION
import example.openclosed.before.CancellationFeeCalculator as BeforeCalculator
import example.openclosed.before.CUSTOM_MADE
import example.openclosed.before.EXPRESS
import example.openclosed.before.Order as BeforeOrder
import example.openclosed.before.RefundDescription
import example.openclosed.before.STANDARD
import example.openclosed.before.SUBSCRIPTION
import kotlin.test.Test
import kotlin.test.assertEquals

class OpenClosedTest {
    @Test
    fun `before - fee for a pending standard order is free`() {
        val order = BeforeOrder(type = STANDARD, amount = 100.0, pending = true)
        assertEquals(0.0, BeforeCalculator().calculateFee(order))
    }

    @Test
    fun `before - fee for a shipped standard order is the full amount`() {
        val order = BeforeOrder(type = STANDARD, amount = 100.0, pending = false)
        assertEquals(100.0, BeforeCalculator().calculateFee(order))
    }

    @Test
    fun `before - fee and description for an express order`() {
        val order = BeforeOrder(type = EXPRESS, amount = 100.0)
        assertEquals(15.0, BeforeCalculator().calculateFee(order))
        assertEquals("Refund minus a flat express handling fee", RefundDescription().describe(order))
    }

    @Test
    fun `before - fee for a subscription order is prorated by elapsed months`() {
        val order = BeforeOrder(type = SUBSCRIPTION, amount = 120.0, monthsElapsed = 3, totalMonths = 12)
        assertEquals(30.0, BeforeCalculator().calculateFee(order))
    }

    @Test
    fun `before - a custom-made order gets the wrong refund description despite the right fee`() {
        val order = BeforeOrder(type = CUSTOM_MADE, amount = 200.0)
        assertEquals(100.0, BeforeCalculator().calculateFee(order))
        assertEquals("Refund processed", RefundDescription().describe(order))
    }

    @Test
    fun `after - fee for a pending standard order is free`() {
        val order = AfterOrder(type = AFTER_STANDARD, amount = 100.0, pending = true)
        assertEquals(0.0, AfterCalculator().calculateFee(order))
    }

    @Test
    fun `after - fee for a shipped standard order is the full amount`() {
        val order = AfterOrder(type = AFTER_STANDARD, amount = 100.0, pending = false)
        assertEquals(100.0, AfterCalculator().calculateFee(order))
    }

    @Test
    fun `after - fee and description for an express order`() {
        val order = AfterOrder(type = AFTER_EXPRESS, amount = 100.0)
        val calculator = AfterCalculator()
        assertEquals(15.0, calculator.calculateFee(order))
        assertEquals("Refund minus a flat express handling fee", calculator.describeRefund(order))
    }

    @Test
    fun `after - fee for a subscription order is prorated by elapsed months`() {
        val order = AfterOrder(type = AFTER_SUBSCRIPTION, amount = 120.0, monthsElapsed = 3, totalMonths = 12)
        assertEquals(30.0, AfterCalculator().calculateFee(order))
    }

    @Test
    fun `after - a custom-made order gets its own refund description`() {
        val order = AfterOrder(type = AFTER_CUSTOM_MADE, amount = 200.0)
        val calculator = AfterCalculator()
        assertEquals(100.0, calculator.calculateFee(order))
        assertEquals("50% refund, materials already committed", calculator.describeRefund(order))
    }

    // A brand-new order type; no existing policy or calculator file is
    // touched to add it.
    private class GiftFeePolicy : FeePolicy {
        override fun fee(order: AfterOrder): Double = 0.0
        override fun describeRefund(order: AfterOrder): String = "Full refund, gift orders are always free to cancel"
    }

    @Test
    fun `after - adding a gift policy needs no change to existing policies`() {
        val policies = defaultPolicies() + ("gift" to GiftFeePolicy())
        val calculator = AfterCalculator(policies)
        val order = AfterOrder(type = "gift", amount = 50.0)
        assertEquals(0.0, calculator.calculateFee(order))
        assertEquals("Full refund, gift orders are always free to cancel", calculator.describeRefund(order))
    }
}
