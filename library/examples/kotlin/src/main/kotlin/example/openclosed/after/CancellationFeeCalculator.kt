package example.openclosed.after

// Chooses the policy once, by order type; a new type means adding to the map
// passed in here, never a new branch in this class.
class CancellationFeeCalculator(private val policies: Map<String, FeePolicy> = defaultPolicies()) {
    fun calculateFee(order: Order): Double = policies.getValue(order.type).fee(order)

    fun describeRefund(order: Order): String = policies.getValue(order.type).describeRefund(order)
}
