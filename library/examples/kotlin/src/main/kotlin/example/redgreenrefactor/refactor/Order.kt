package example.redgreenrefactor.refactor

// The rule, named and in one place instead of a bare comparison inside cancel() — internal only. The public
// shape is identical to green: the constructor and status are both String.
private val nonCancellableStatuses = setOf("shipped")

class Order(var status: String = "pending") {
    fun canCancel(): Boolean = status !in nonCancellableStatuses

    fun cancel() {
        check(canCancel()) { "a shipped order can't be cancelled" }
        status = "cancelled"
    }
}
