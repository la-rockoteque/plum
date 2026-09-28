package example.redgreenrefactor.red

// No rule yet: any status can be cancelled.
class Order(var status: String = "pending") {
    fun cancel() {
        status = "cancelled"
    }
}
