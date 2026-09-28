from dataclasses import replace

from testing_through_public_api.post_refactor import (
    Notifier,
    Order,
    OrderRepository,
    OrderStatus,
    PostRefactorService,
)
from testing_through_public_api.pre_refactor import PreRefactorService


class InMemoryOrderRepository:
    """Fake: real find/save behaviour, no external system. Copies on write and read, so a
    caller can't observe state through a reference it never went through the repository for."""

    def __init__(self, orders: list[Order]) -> None:
        self._orders = {order.id: replace(order) for order in orders}

    def find_by_id(self, order_id: int) -> Order:
        return replace(self._orders[order_id])

    def save(self, order: Order) -> None:
        self._orders[order.id] = replace(order)


class SpyNotifier:
    """Spy: records what was sent so the test can assert afterwards."""

    def __init__(self) -> None:
        self.sent: list[str] = []

    def send(self, message: str) -> None:
        self.sent.append(message)


class MockNotificationFormatter:
    """A hand-rolled double for the service's OWN internal collaborator - not a port."""

    def __init__(self) -> None:
        self.called_with: tuple[int, int] | None = None

    def format(self, order_id: int, refund_amount_minor: int) -> str:
        self.called_with = (order_id, refund_amount_minor)
        return "mocked notification"


def _an_order(order_id: int = 1, amount_minor: int = 5000) -> Order:
    return Order(order_id, amount_minor)


# --- before: internal-poking tests -----------------------------------------------------------


def test_before_poking_the_private_fee_helper_and_field_passes_against_the_pre_refactor_implementation() -> None:
    order = _an_order()
    service = PreRefactorService(InMemoryOrderRepository([order]), SpyNotifier())
    # Reach past cancel() and call the private helper directly.
    fee = service._calculate_fee(order)
    assert fee == 500
    # Assert on a private field instead of an observable outcome.
    assert service._fee_rate == 0.1


def test_before_mocking_the_services_own_formatter_passes_but_couples_the_test_to_implementation() -> None:
    order = _an_order()
    service = PreRefactorService(InMemoryOrderRepository([order]), SpyNotifier())
    mock_formatter = MockNotificationFormatter()
    service._formatter = mock_formatter  # reach in and replace a collaborator the service built for itself
    service.cancel(1)
    assert mock_formatter.called_with == (1, 4500)


def test_before_the_same_private_poking_assertions_no_longer_hold_after_a_pure_refactor() -> None:
    order = _an_order()
    service = PostRefactorService(InMemoryOrderRepository([order]), SpyNotifier())
    # The helper the pre-refactor test called directly is gone: inlined into cancel().
    assert not hasattr(service, "_calculate_fee")
    # The field the pre-refactor test asserted on directly was renamed.
    assert not hasattr(service, "_fee_rate")
    assert service._cancellation_fee_rate == 0.1


# --- after: public-API tests, run unmodified against both implementations ---------------------


def _assert_cancelling_order_1_behaves_correctly(service: PreRefactorService | PostRefactorService) -> None:
    outcome = service.cancel(1)
    assert outcome.order_id == 1
    assert outcome.refund_amount_minor == 4500
    assert outcome.status == OrderStatus.CANCELLED
    # Observable via the fake repository: state was actually persisted.
    assert service.orders.find_by_id(1).status == OrderStatus.CANCELLED
    # Observable via the notifier spy: the right message was sent.
    assert service.notifier.sent == ["Order 1 cancelled; refund 4500"]


def test_after_cancelling_through_the_public_api_behaves_identically_against_the_pre_refactor_implementation() -> None:
    service = PreRefactorService(InMemoryOrderRepository([_an_order()]), SpyNotifier())
    _assert_cancelling_order_1_behaves_correctly(service)


def test_after_cancelling_through_the_public_api_behaves_identically_against_the_post_refactor_implementation() -> None:
    service = PostRefactorService(InMemoryOrderRepository([_an_order()]), SpyNotifier())
    _assert_cancelling_order_1_behaves_correctly(service)
