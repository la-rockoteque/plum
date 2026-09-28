package example.characterizationtests.refactored

private const val MS_PER_DAY = 24 * 60 * 60 * 1000L
private const val FULL_REFUND_WINDOW_DAYS = 14
private const val LATE_REFUND_PERCENT = 90
private const val STALE_ORDER_THRESHOLD_DAYS = 30
private const val STALE_REFUND_ROUNDING_UNIT_MINOR = 100L

data class Order(
    val orderId: Long,
    val amountMinor: Long,
    val purchasedAtMs: Long,
    val status: String,
)

private fun ageInDays(order: Order, todayMs: Long): Long = (todayMs - order.purchasedAtMs) / MS_PER_DAY

private fun baseRefundMinor(order: Order, ageDays: Long): Long =
    if (ageDays <= FULL_REFUND_WINDOW_DAYS) order.amountMinor else (order.amountMinor * LATE_REFUND_PERCENT) / 100

private fun roundDownIfStale(refundMinor: Long, ageDays: Long): Long =
    if (ageDays > STALE_ORDER_THRESHOLD_DAYS) (refundMinor / STALE_REFUND_ROUNDING_UNIT_MINOR) * STALE_REFUND_ROUNDING_UNIT_MINOR else refundMinor

// Same behaviour as legacy.computeRefund, including its odd cases - named and pinned by the
// characterization tests rather than "fixed" in passing.
fun computeRefund(order: Order, todayMs: Long): Long {
    if (order.status == "hold") return 0
    val ageDays = ageInDays(order, todayMs)
    val refund = baseRefundMinor(order, ageDays)
    return roundDownIfStale(refund, ageDays)
}
