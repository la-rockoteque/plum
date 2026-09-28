package example.openclosed.after

// after: cancellation fees and refund descriptions vary by order type.
const val STANDARD = "standard"
const val EXPRESS = "express"
const val CUSTOM_MADE = "custom-made"
const val SUBSCRIPTION = "subscription"

data class Order(
    val type: String,
    val amount: Double,
    val pending: Boolean = true,
    val monthsElapsed: Int = 0,
    val totalMonths: Int = 1,
)
