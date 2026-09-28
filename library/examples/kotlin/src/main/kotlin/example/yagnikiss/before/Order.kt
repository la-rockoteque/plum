package example.yagnikiss.before

// before: a pluggable CancellationPolicy registry, hooks and a config flag — for one policy that exists.
const val CANCELLATION_WINDOW_MS = 24L * 60 * 60 * 1000
const val DEFAULT_POLICY_NAME = "standard"

enum class OrderStatus { PENDING, SHIPPED, CANCELLED }

data class Order(val id: Int, val status: OrderStatus, val placedAtMs: Long)

interface Clock {
    fun nowMs(): Long
}

interface CancellationPolicy {
    fun canCancel(order: Order, clock: Clock): Boolean
}

// The only policy that has ever existed.
class StandardCancellationPolicy : CancellationPolicy {
    override fun canCancel(order: Order, clock: Clock): Boolean {
        if (order.status != OrderStatus.PENDING) return false
        return clock.nowMs() - order.placedAtMs <= CANCELLATION_WINDOW_MS
    }
}

// Extension points nobody has ever wired up.
class CancellationHooks {
    val onBeforeCancel: MutableList<(Order) -> Unit> = mutableListOf()
    val onAfterCancel: MutableList<(Order) -> Unit> = mutableListOf()
}

// A pluggable seam for a second policy that has never shown up.
class CancellationPolicyRegistry {
    private val policies: MutableMap<String, CancellationPolicy> =
        mutableMapOf(DEFAULT_POLICY_NAME to StandardCancellationPolicy())

    fun register(name: String, policy: CancellationPolicy) {
        policies[name] = policy
    }

    // A typo in `name` is silently swallowed: it just falls back to the default.
    fun resolve(name: String): CancellationPolicy = policies[name] ?: policies.getValue(DEFAULT_POLICY_NAME)
}

class OrderCancellationService(
    policyName: String = DEFAULT_POLICY_NAME,
    val hooks: CancellationHooks = CancellationHooks(),
    val strictMode: Boolean = false, // dead: nothing reads this flag
    registry: CancellationPolicyRegistry = CancellationPolicyRegistry(),
) {
    private val policy: CancellationPolicy = registry.resolve(policyName)

    fun canCancel(order: Order, clock: Clock): Boolean {
        hooks.onBeforeCancel.forEach { it(order) }
        val result = policy.canCancel(order, clock)
        hooks.onAfterCancel.forEach { it(order) }
        return result
    }
}
