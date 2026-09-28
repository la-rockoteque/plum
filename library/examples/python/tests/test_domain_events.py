import pytest

from domain_events.after import (
    CancelOrderService,
    EventDispatcher,
    InMemoryOrderRepository,
    Order,
    OrderCancelled,
    RecordLoyaltyCancellationHandler,
    ReleaseInventoryHandler,
    SendCancellationEmailHandler,
)
from domain_events.before import Order as BeforeOrder


class FixedClock:
    def __init__(self, ms: int) -> None:
        self._ms = ms

    def now_ms(self) -> int:
        return self._ms


class FakeInventoryService:
    def __init__(self) -> None:
        self.released: list[int] = []

    def release(self, order_id: int) -> None:
        self.released.append(order_id)


class FakeMailer:
    def __init__(self) -> None:
        self.sent: list[int] = []

    def send_cancellation_email(self, order_id: int) -> None:
        self.sent.append(order_id)


class MailerUnavailableError(Exception):
    pass


class FailingMailer:
    def send_cancellation_email(self, order_id: int) -> None:
        raise MailerUnavailableError("mailer unavailable")


class FakeLoyaltyLedger:
    def __init__(self) -> None:
        self.recorded: list[int] = []

    def record_cancellation(self, order_id: int) -> None:
        self.recorded.append(order_id)


class StorageUnavailableError(Exception):
    pass


class FailingSaveOrderRepository(InMemoryOrderRepository):
    def __init__(self) -> None:
        super().__init__()
        self.fail_on_save = False

    def save(self, order: Order) -> None:
        if self.fail_on_save:
            raise StorageUnavailableError("storage unavailable")
        super().save(order)


def test_before_cancelling_calls_the_inventory_mailer_and_loyalty_collaborators_directly() -> None:
    inventory, mailer, loyalty = FakeInventoryService(), FakeMailer(), FakeLoyaltyLedger()
    order = BeforeOrder(id=1, inventory=inventory, mailer=mailer, loyalty=loyalty)
    order.cancel("customer request")
    assert inventory.released == [1]
    assert mailer.sent == [1]
    assert loyalty.recorded == [1]
    assert order.status == "cancelled"


def test_before_a_failing_mailer_leaves_inventory_released_but_the_order_not_cancelled() -> None:
    inventory, loyalty = FakeInventoryService(), FakeLoyaltyLedger()
    order = BeforeOrder(id=1, inventory=inventory, mailer=FailingMailer(), loyalty=loyalty)
    with pytest.raises(MailerUnavailableError):
        order.cancel("customer request")
    assert inventory.released == [1]  # already ran
    assert loyalty.recorded == []  # never reached
    assert order.status == "pending"  # inconsistent: inventory thinks it's released, order disagrees


def test_after_cancel_records_exactly_one_order_cancelled_event_with_the_right_data() -> None:
    order = Order(id=1)
    order.cancel("customer request", FixedClock(1_000))
    events = order.pull_events()
    assert events == [OrderCancelled(order_id=1, reason="customer request", occurred_at_ms=1_000)]
    assert order.status == "cancelled"


def test_after_cancelling_through_the_service_dispatches_to_every_registered_handler_after_a_successful_save() -> None:
    repo = InMemoryOrderRepository()
    repo.save(Order(id=1))
    dispatcher = EventDispatcher()
    inventory, mailer, loyalty = FakeInventoryService(), FakeMailer(), FakeLoyaltyLedger()
    dispatcher.register(OrderCancelled, ReleaseInventoryHandler(inventory))
    dispatcher.register(OrderCancelled, SendCancellationEmailHandler(mailer))
    dispatcher.register(OrderCancelled, RecordLoyaltyCancellationHandler(loyalty))
    service = CancelOrderService(repo, dispatcher, FixedClock(1_000))

    service.cancel(1, "customer request")

    assert inventory.released == [1]
    assert mailer.sent == [1]
    assert loyalty.recorded == [1]
    saved = repo.get(1)
    assert saved is not None
    assert saved.status == "cancelled"


def test_after_events_are_not_dispatched_when_the_save_fails() -> None:
    repo = FailingSaveOrderRepository()
    repo.save(Order(id=1))
    dispatcher = EventDispatcher()
    mailer = FakeMailer()
    dispatcher.register(OrderCancelled, SendCancellationEmailHandler(mailer))
    service = CancelOrderService(repo, dispatcher, FixedClock(1_000))
    repo.fail_on_save = True

    with pytest.raises(StorageUnavailableError):
        service.cancel(1, "customer request")

    assert mailer.sent == []


def test_after_the_inventory_handler_releases_inventory_for_the_cancelled_order() -> None:
    inventory = FakeInventoryService()
    handler = ReleaseInventoryHandler(inventory)
    handler.handle(OrderCancelled(order_id=1, reason="customer request", occurred_at_ms=1_000))
    assert inventory.released == [1]


def test_after_the_mailer_handler_sends_a_cancellation_email() -> None:
    mailer = FakeMailer()
    handler = SendCancellationEmailHandler(mailer)
    handler.handle(OrderCancelled(order_id=1, reason="customer request", occurred_at_ms=1_000))
    assert mailer.sent == [1]


def test_after_the_loyalty_handler_records_the_cancellation() -> None:
    loyalty = FakeLoyaltyLedger()
    handler = RecordLoyaltyCancellationHandler(loyalty)
    handler.handle(OrderCancelled(order_id=1, reason="customer request", occurred_at_ms=1_000))
    assert loyalty.recorded == [1]


def test_after_a_failing_handler_does_not_undo_the_cancellation() -> None:
    repo = InMemoryOrderRepository()
    repo.save(Order(id=1))
    dispatcher = EventDispatcher()
    inventory, loyalty = FakeInventoryService(), FakeLoyaltyLedger()
    dispatcher.register(OrderCancelled, ReleaseInventoryHandler(inventory))
    dispatcher.register(OrderCancelled, SendCancellationEmailHandler(FailingMailer()))
    dispatcher.register(OrderCancelled, RecordLoyaltyCancellationHandler(loyalty))
    service = CancelOrderService(repo, dispatcher, FixedClock(1_000))

    with pytest.raises(MailerUnavailableError):
        service.cancel(1, "customer request")

    saved = repo.get(1)
    assert saved is not None
    assert saved.status == "cancelled"  # the save already committed before the handler ran
    assert inventory.released == [1]  # handler before the failing one still ran
    assert loyalty.recorded == []  # handler after the failing one never ran
