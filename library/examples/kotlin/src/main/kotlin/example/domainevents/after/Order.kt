package example.domainevents.after

// cancel() only changes state and records an event; handlers react later.
class OrderAlreadyCancelledException(message: String) : Exception(message)
class OrderNotFoundException(message: String) : Exception(message)

interface Clock {
    fun nowMs(): Long
}

interface InventoryService {
    fun release(orderId: Int)
}

interface Mailer {
    fun sendCancellationEmail(orderId: Int)
}

interface LoyaltyLedger {
    fun recordCancellation(orderId: Int)
}

// An immutable fact: this happened. Not a request for anything to happen.
data class OrderCancelled(val orderId: Int, val reason: String, val occurredAtMs: Long)

// The aggregate root: cancel() changes state and records what happened, nothing else.
class Order(val id: Int) {
    var status: String = "pending"
        private set

    private val events = mutableListOf<OrderCancelled>()

    fun cancel(reason: String, clock: Clock) {
        if (status == "cancelled") {
            throw OrderAlreadyCancelledException("order is already cancelled")
        }
        status = "cancelled"
        events.add(OrderCancelled(id, reason, clock.nowMs()))
    }

    // Returns the recorded events and clears them, so a dispatch is never repeated.
    fun pullEvents(): List<OrderCancelled> {
        val pulled = events.toList()
        events.clear()
        return pulled
    }
}

interface OrderRepository {
    fun get(orderId: Int): Order?
    fun save(order: Order)
}

open class InMemoryOrderRepository : OrderRepository {
    private val orders = mutableMapOf<Int, Order>()

    override fun get(orderId: Int): Order? = orders[orderId]

    override fun save(order: Order) {
        orders[order.id] = order
    }
}

interface EventHandler {
    fun handle(event: OrderCancelled)
}

// A plain list of handlers per event type. No framework, no ordering guarantees beyond registration order.
class EventDispatcher {
    private val handlers = mutableMapOf<Class<*>, MutableList<EventHandler>>()

    fun register(eventType: Class<*>, handler: EventHandler) {
        handlers.getOrPut(eventType) { mutableListOf() }.add(handler)
    }

    fun dispatch(events: List<OrderCancelled>) {
        for (event in events) {
            for (handler in handlers[event::class.java].orEmpty()) {
                handler.handle(event)
            }
        }
    }
}

class ReleaseInventoryHandler(private val inventory: InventoryService) : EventHandler {
    override fun handle(event: OrderCancelled) = inventory.release(event.orderId)
}

class SendCancellationEmailHandler(private val mailer: Mailer) : EventHandler {
    override fun handle(event: OrderCancelled) = mailer.sendCancellationEmail(event.orderId)
}

class RecordLoyaltyCancellationHandler(private val loyalty: LoyaltyLedger) : EventHandler {
    override fun handle(event: OrderCancelled) = loyalty.recordCancellation(event.orderId)
}

// The application service: save the aggregate, then dispatch what it recorded.
class CancelOrderService(
    private val repo: OrderRepository,
    private val dispatcher: EventDispatcher,
    private val clock: Clock,
) {
    fun cancel(orderId: Int, reason: String) {
        val order = repo.get(orderId) ?: throw OrderNotFoundException("no such order: $orderId")
        order.cancel(reason, clock)
        repo.save(order)
        dispatcher.dispatch(order.pullEvents())
    }
}
