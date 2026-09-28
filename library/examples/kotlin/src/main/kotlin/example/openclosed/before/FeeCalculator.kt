package example.openclosed.before

// One switch on order.type decides the fee — and it isn't the only one
// (see RefundDescription.kt).
class CancellationFeeCalculator {
    fun calculateFee(order: Order): Double = when (order.type) {
        STANDARD -> if (order.pending) 0.0 else order.amount
        EXPRESS -> EXPRESS_FLAT_FEE
        CUSTOM_MADE -> order.amount * CUSTOM_MADE_FEE_RATE
        SUBSCRIPTION -> order.amount * order.monthsElapsed / order.totalMonths
        else -> throw IllegalArgumentException("unhandled order type: ${order.type}")
    }
}
