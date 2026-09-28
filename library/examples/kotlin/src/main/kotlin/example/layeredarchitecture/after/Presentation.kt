package example.layeredarchitecture.after

data class CancelRequest(val orderId: String) // arrives as a string, as it would from a web request

data class CancelResponse(val status: String, val message: String) // "ok" | "invalid" | "not_found" | "rejected"

// What the handler depends on: the application layer, not any one implementation.
interface CancelOrderUseCase {
    fun execute(orderId: Int)
}

// Presentation layer: parse the request into a command, call the use case, shape a response.
fun handleCancelRequest(request: CancelRequest, useCase: CancelOrderUseCase): CancelResponse {
    val orderId = request.orderId.toIntOrNull()
        ?: return CancelResponse("invalid", "order id must be a number")

    try {
        useCase.execute(orderId)
    } catch (e: OrderNotFound) {
        return CancelResponse("not_found", "order $orderId not found")
    } catch (e: OrderCannotBeCancelled) {
        return CancelResponse("rejected", e.message ?: "order $orderId cannot be cancelled")
    }
    return CancelResponse("ok", "order $orderId cancelled")
}
