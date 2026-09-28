"""after: cancel() only changes state and records an event; handlers react later."""
from dataclasses import dataclass
from typing import Protocol


class OrderAlreadyCancelledError(Exception):
    pass


class Clock(Protocol):
    def now_ms(self) -> int: ...


class InventoryService(Protocol):
    def release(self, order_id: int) -> None: ...


class Mailer(Protocol):
    def send_cancellation_email(self, order_id: int) -> None: ...


class LoyaltyLedger(Protocol):
    def record_cancellation(self, order_id: int) -> None: ...


@dataclass(frozen=True)
class OrderCancelled:
    """An immutable fact: this happened. Not a request for anything to happen."""

    order_id: int
    reason: str
    occurred_at_ms: int


class Order:
    """The aggregate root: cancel() changes state and records what happened, nothing else."""

    def __init__(self, id: int) -> None:
        self.id = id
        self._status = "pending"
        self._events: list[OrderCancelled] = []

    @property
    def status(self) -> str:
        return self._status

    def cancel(self, reason: str, clock: Clock) -> None:
        if self._status == "cancelled":
            raise OrderAlreadyCancelledError("order is already cancelled")
        self._status = "cancelled"
        self._events.append(OrderCancelled(order_id=self.id, reason=reason, occurred_at_ms=clock.now_ms()))

    def pull_events(self) -> list[OrderCancelled]:
        """Returns the recorded events and clears them, so a dispatch is never repeated."""
        events, self._events = self._events, []
        return events


class OrderRepository(Protocol):
    def get(self, order_id: int) -> Order | None: ...
    def save(self, order: Order) -> None: ...


class InMemoryOrderRepository:
    def __init__(self) -> None:
        self._orders: dict[int, Order] = {}

    def get(self, order_id: int) -> Order | None:
        return self._orders.get(order_id)

    def save(self, order: Order) -> None:
        self._orders[order.id] = order


class EventHandler(Protocol):
    def handle(self, event: OrderCancelled) -> None: ...


class EventDispatcher:
    """A plain list of handlers per event type. No framework, no ordering guarantees beyond registration order."""

    def __init__(self) -> None:
        self._handlers: dict[type, list[EventHandler]] = {}

    def register(self, event_type: type, handler: EventHandler) -> None:
        self._handlers.setdefault(event_type, []).append(handler)

    def dispatch(self, events: list[OrderCancelled]) -> None:
        for event in events:
            for handler in self._handlers.get(type(event), []):
                handler.handle(event)


class ReleaseInventoryHandler:
    def __init__(self, inventory: InventoryService) -> None:
        self._inventory = inventory

    def handle(self, event: OrderCancelled) -> None:
        self._inventory.release(event.order_id)


class SendCancellationEmailHandler:
    def __init__(self, mailer: Mailer) -> None:
        self._mailer = mailer

    def handle(self, event: OrderCancelled) -> None:
        self._mailer.send_cancellation_email(event.order_id)


class RecordLoyaltyCancellationHandler:
    def __init__(self, loyalty: LoyaltyLedger) -> None:
        self._loyalty = loyalty

    def handle(self, event: OrderCancelled) -> None:
        self._loyalty.record_cancellation(event.order_id)


class CancelOrderService:
    """The application service: save the aggregate, then dispatch what it recorded."""

    def __init__(self, repo: OrderRepository, dispatcher: EventDispatcher, clock: Clock) -> None:
        self._repo = repo
        self._dispatcher = dispatcher
        self._clock = clock

    def cancel(self, order_id: int, reason: str) -> None:
        order = self._repo.get(order_id)
        assert order is not None, f"no such order: {order_id}"
        order.cancel(reason, self._clock)
        self._repo.save(order)
        self._dispatcher.dispatch(order.pull_events())
