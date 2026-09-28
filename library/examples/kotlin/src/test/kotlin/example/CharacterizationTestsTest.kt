package example

import example.characterizationtests.legacy.Order as LegacyOrder
import example.characterizationtests.legacy.computeRefund as legacyComputeRefund
import example.characterizationtests.refactored.Order as RefactoredOrder
import example.characterizationtests.refactored.computeRefund as refactoredComputeRefund
import kotlin.test.Test
import kotlin.test.assertEquals

private const val MS_PER_DAY = 24 * 60 * 60 * 1000L
private const val TODAY_MS = 1_700_000_000_000L

class CharacterizationTestsTest {
    @Test
    fun `before - nobody knows what computeRefund does for most inputs`() {
        // The starting point of legacy work: one sample input pinned, nothing more understood yet.
        val order = LegacyOrder(orderId = 1, amountMinor = 10_000, purchasedAtMs = TODAY_MS - 5 * MS_PER_DAY, status = "active")
        assertEquals(10_000, legacyComputeRefund(order, TODAY_MS))
    }

    @Test
    fun `currently a hold order refunds zero regardless of age`() {
        val legacy = LegacyOrder(orderId = 2, amountMinor = 10_000, purchasedAtMs = TODAY_MS - 5 * MS_PER_DAY, status = "hold")
        val refactored = RefactoredOrder(orderId = 2, amountMinor = 10_000, purchasedAtMs = TODAY_MS - 5 * MS_PER_DAY, status = "hold")
        assertEquals(0, legacyComputeRefund(legacy, TODAY_MS))
        assertEquals(0, refactoredComputeRefund(refactored, TODAY_MS))
    }

    @Test
    fun `currently an order exactly 14 days old gets a full refund`() {
        val legacy = LegacyOrder(orderId = 3, amountMinor = 10_000, purchasedAtMs = TODAY_MS - 14 * MS_PER_DAY, status = "active")
        val refactored = RefactoredOrder(orderId = 3, amountMinor = 10_000, purchasedAtMs = TODAY_MS - 14 * MS_PER_DAY, status = "active")
        assertEquals(10_000, legacyComputeRefund(legacy, TODAY_MS))
        assertEquals(10_000, refactoredComputeRefund(refactored, TODAY_MS))
    }

    @Test
    fun `currently an order 15 days old refunds 90 percent`() {
        val legacy = LegacyOrder(orderId = 4, amountMinor = 10_000, purchasedAtMs = TODAY_MS - 15 * MS_PER_DAY, status = "active")
        val refactored = RefactoredOrder(orderId = 4, amountMinor = 10_000, purchasedAtMs = TODAY_MS - 15 * MS_PER_DAY, status = "active")
        assertEquals(9_000, legacyComputeRefund(legacy, TODAY_MS))
        assertEquals(9_000, refactoredComputeRefund(refactored, TODAY_MS))
    }

    @Test
    fun `currently an order exactly 30 days old is not rounded down`() {
        val legacy = LegacyOrder(orderId = 5, amountMinor = 10_050, purchasedAtMs = TODAY_MS - 30 * MS_PER_DAY, status = "active")
        val refactored = RefactoredOrder(orderId = 5, amountMinor = 10_050, purchasedAtMs = TODAY_MS - 30 * MS_PER_DAY, status = "active")
        assertEquals(9_045, legacyComputeRefund(legacy, TODAY_MS))
        assertEquals(9_045, refactoredComputeRefund(refactored, TODAY_MS))
    }

    @Test
    fun `currently an order older than 30 days rounds the refund down to the nearest hundred`() {
        val legacy = LegacyOrder(orderId = 6, amountMinor = 10_050, purchasedAtMs = TODAY_MS - 31 * MS_PER_DAY, status = "active")
        val refactored = RefactoredOrder(orderId = 6, amountMinor = 10_050, purchasedAtMs = TODAY_MS - 31 * MS_PER_DAY, status = "active")
        assertEquals(9_000, legacyComputeRefund(legacy, TODAY_MS))
        assertEquals(9_000, refactoredComputeRefund(refactored, TODAY_MS))
    }
}
