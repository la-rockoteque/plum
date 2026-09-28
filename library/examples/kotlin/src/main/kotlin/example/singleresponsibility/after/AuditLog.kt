package example.singleresponsibility.after

// Owns the audit entry format — its only reason to change. Satisfies
// CancelOrder's Auditor port structurally; nothing declares it.
class AuditLog {
    val entries = mutableListOf<String>()

    fun recordCancelled(order: Order, reason: String) {
        entries.add("${order.id}|CANCELLED|$reason")
    }
}
