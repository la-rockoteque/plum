package example.redgreenrefactor.green

// Minimal fix: a bare status-string comparison, right where cancel() decides.
class Order(var status: String = "pending") {
    fun cancel() {
        check(status != "shipped") { "a shipped order can't be cancelled" }
        status = "cancelled"
    }
}
