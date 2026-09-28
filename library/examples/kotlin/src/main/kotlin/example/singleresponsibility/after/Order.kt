package example.singleresponsibility.after

data class Order(
    val id: String,
    val customerName: String,
    val customerEmail: String,
    var status: String = "pending",
)
