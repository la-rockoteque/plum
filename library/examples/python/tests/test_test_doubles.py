import pytest

from test_doubles.after import (
    AuditLogger,
    CancelOrder,
    Mailer,
    Order,
    OrderRepository,
    PaymentGateway,
)
from test_doubles.before import CancelOrder as BeforeCancelOrder
from test_doubles.before import Order as BeforeOrder


def test_before_cancelling_an_order_blows_up_instead_of_completing() -> None:
    order = BeforeOrder("order-1", "ada@example.com", 5.0)
    with pytest.raises(RuntimeError, match="network unavailable"):
        BeforeCancelOrder().execute(order)
    # Nothing about the business outcome is observable: the order never even changed status.
    assert order.status == "placed"


class NullAuditLogger:
    """Dummy: satisfies the constructor. If a test ever asserted on this, it wouldn't be a dummy anymore."""

    def log(self, message: str) -> None:
        raise AssertionError("dummy should never be called")


class InMemoryOrderRepository:
    """Fake: real find/save behaviour, no external system."""

    def __init__(self, orders: list[Order]) -> None:
        self._orders = {order.id: order for order in orders}

    def find_by_id(self, order_id: str) -> Order:
        return self._orders[order_id]

    def save(self, order: Order) -> None:
        self._orders[order.id] = order


class StubPaymentGateway:
    """Stub: a canned response. Nothing is recorded, nothing is verified."""

    def charge(self, order_id: str, amount: float) -> None:
        return None


class MockPaymentGateway:
    """Mock: a hand-rolled expectation. The wrong call fails immediately; the right one is recorded."""

    def __init__(self, expected_order_id: str, expected_amount: float) -> None:
        self._expected_order_id = expected_order_id
        self._expected_amount = expected_amount
        self.called = False

    def charge(self, order_id: str, amount: float) -> None:
        if order_id != self._expected_order_id or amount != self._expected_amount:
            raise AssertionError(f"unexpected charge: {order_id} {amount}")
        self.called = True


class SpyMailer:
    """Spy: records what was sent so the test can assert afterwards (state verification)."""

    def __init__(self) -> None:
        self.sent: list[tuple[str, str]] = []

    def send(self, to: str, message: str) -> None:
        self.sent.append((to, message))


def _order(order_id: str = "order-1", fee: float = 5.0) -> Order:
    return Order(order_id, "ada@example.com", fee)


def test_after_dummy_audit_logger_is_passed_but_never_called() -> None:
    orders: OrderRepository = InMemoryOrderRepository([_order()])
    use_case = CancelOrder(orders, StubPaymentGateway(), SpyMailer(), NullAuditLogger())
    use_case.execute("order-1")  # would raise if the dummy were ever invoked


def test_after_stub_gateway_returns_a_canned_charge_result() -> None:
    orders: OrderRepository = InMemoryOrderRepository([_order()])
    mailer: Mailer = SpyMailer()
    CancelOrder(orders, StubPaymentGateway(), mailer, NullAuditLogger()).execute("order-1")
    # The stub's canned response is enough to let the use case reach the mailer.
    assert mailer.sent


def test_after_spy_mailer_records_the_message_it_sent() -> None:
    orders: OrderRepository = InMemoryOrderRepository([_order()])
    mailer = SpyMailer()
    CancelOrder(orders, StubPaymentGateway(), mailer, NullAuditLogger()).execute("order-1")
    assert mailer.sent == [("ada@example.com", "Your order order-1 was cancelled")]


def test_after_mock_gateway_accepts_the_expected_charge() -> None:
    orders: OrderRepository = InMemoryOrderRepository([_order()])
    gateway = MockPaymentGateway(expected_order_id="order-1", expected_amount=5.0)
    CancelOrder(orders, gateway, SpyMailer(), NullAuditLogger()).execute("order-1")
    assert gateway.called is True


def test_after_mock_gateway_rejects_an_unexpected_amount() -> None:
    orders: OrderRepository = InMemoryOrderRepository([_order(fee=999.0)])
    gateway: PaymentGateway = MockPaymentGateway(expected_order_id="order-1", expected_amount=5.0)
    with pytest.raises(AssertionError, match="unexpected charge"):
        CancelOrder(orders, gateway, SpyMailer(), NullAuditLogger()).execute("order-1")


def test_after_fake_repository_saves_the_cancelled_order() -> None:
    orders = InMemoryOrderRepository([_order()])
    CancelOrder(orders, StubPaymentGateway(), SpyMailer(), NullAuditLogger()).execute("order-1")
    # Real behaviour: a later read reflects what an earlier write saved.
    assert orders.find_by_id("order-1").status == "cancelled"
