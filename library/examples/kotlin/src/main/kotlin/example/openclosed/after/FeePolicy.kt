package example.openclosed.after

// One policy per order type: each owns both its fee and its refund
// description, so the two concerns can never fall out of sync again.
interface FeePolicy {
    fun fee(order: Order): Double
    fun describeRefund(order: Order): String
}

const val EXPRESS_FLAT_FEE = 15.0
const val CUSTOM_MADE_FEE_RATE = 0.5

class StandardFeePolicy : FeePolicy {
    override fun fee(order: Order): Double = if (order.pending) 0.0 else order.amount
    override fun describeRefund(order: Order): String =
        if (order.pending) "Full refund, order not yet processed" else "No refund, order already shipped"
}

class ExpressFeePolicy : FeePolicy {
    override fun fee(order: Order): Double = EXPRESS_FLAT_FEE
    override fun describeRefund(order: Order): String = "Refund minus a flat express handling fee"
}

class CustomMadeFeePolicy : FeePolicy {
    override fun fee(order: Order): Double = order.amount * CUSTOM_MADE_FEE_RATE
    override fun describeRefund(order: Order): String = "50% refund, materials already committed"
}

class SubscriptionFeePolicy : FeePolicy {
    override fun fee(order: Order): Double = order.amount * order.monthsElapsed / order.totalMonths
    override fun describeRefund(order: Order): String = "Prorated refund for unused months"
}

fun defaultPolicies(): Map<String, FeePolicy> = mapOf(
    STANDARD to StandardFeePolicy(),
    EXPRESS to ExpressFeePolicy(),
    CUSTOM_MADE to CustomMadeFeePolicy(),
    SUBSCRIPTION to SubscriptionFeePolicy(),
)
