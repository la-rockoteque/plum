package example.cqrs

import example.application.OrderNotFound

data class OrderSummary(val id: Int, val status: String, val canCancel: Boolean)

interface OrderSummaryReader {
    fun getSummary(orderId: Int): OrderSummary?
}

class GetOrderSummary(private val reader: OrderSummaryReader) {
    fun execute(orderId: Int): OrderSummary =
        reader.getSummary(orderId) ?: throw OrderNotFound(orderId)
}
