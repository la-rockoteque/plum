package example.openclosed.before

// before: cancellation fees and refund descriptions vary by order type.
const val STANDARD = "standard"
const val EXPRESS = "express"
const val CUSTOM_MADE = "custom-made"
const val SUBSCRIPTION = "subscription"

const val EXPRESS_FLAT_FEE = 15.0
const val CUSTOM_MADE_FEE_RATE = 0.5

data class Order(
    val type: String,
    val amount: Double,
    val pending: Boolean = true,
    val monthsElapsed: Int = 0,
    val totalMonths: Int = 1,
)
