package example.domainevents.before

// cancel() calls three unrelated services inline — the aggregate imports all of them.
class OrderAlreadyCancelledException(message: String) : Exception(message)

interface InventoryService {
    fun release(orderId: Int)
}

interface Mailer {
    fun sendCancellationEmail(orderId: Int)
}

interface LoyaltyLedger {
    fun recordCancellation(orderId: Int)
}

// Depends on three collaborators just to change its own status.
class Order(
    val id: Int,
    private val inventory: InventoryService,
    private val mailer: Mailer,
    private val loyalty: LoyaltyLedger,
) {
    var status: String = "pending"
        private set

    fun cancel(reason: String) {
        if (status == "cancelled") {
            throw OrderAlreadyCancelledException("order is already cancelled")
        }
        // If any of these three calls throws, the ones before it already ran
        // and the ones after it never will — and status is set only at the end.
        inventory.release(id)
        mailer.sendCancellationEmail(id)
        loyalty.recordCancellation(id)
        status = "cancelled"
    }
}
