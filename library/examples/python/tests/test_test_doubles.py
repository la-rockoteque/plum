from dataclasses import replace

import pytest

from test_doubles.after import (
    AuditLogger,
    CancelOrder,
    ChargeResult,
    Mailer,
    Order,
    OrderRepository,
    OrderStatus,
    PaymentGateway,
)
from test_doubles.before import CancelOrder as BeforeCancelOrder
from test_doubles.before import Order as BeforeOrder


def test_before_cancelling_an_order_blows_up_instead_of_completing() -> None:
    order = BeforeOrder(1, "ada@example.com", 500)
    with pytest.raises(RuntimeError, match="network unavailable"):
        BeforeCancelOrder().execute(order)
    # Nothing about the business outcome is observable: the order never even changed status.
    assert order.status == "pending"


class NullAuditLogger:
    """Dummy: satisfies the constructor. If a test ever asserted on this, it wouldn't be a dummy anymore."""

    def log(self, message: str) -> None:
        raise AssertionError("dummy should never be called")


class SpyAuditLogger:
    """Spy: records the decline message so the test can assert afterwards. The audit
    logger becomes a real collaborator once a charge is declined."""

    def __init__(self) -> None:
        self.messages: list[str] = []

    def log(self, message: str) -> None:
        self.messages.append(message)


class InMemoryOrderRepository:
    """Fake: real get/save behaviour, no external system. Copies on write and on read,
    so mutating what get() returns never leaks into storage until save() is called."""

    def __init__(self, orders: list[Order]) -> None:
        self._orders = {order.id: replace(order) for order in orders}

    def get(self, order_id: int) -> Order:
        return replace(self._orders[order_id])

    def save(self, order: Order) -> None:
        self._orders[order.id] = replace(order)


class StubPaymentGateway:
    """Stub: a canned response. Nothing is recorded, nothing is verified."""

    def __init__(self, result: ChargeResult) -> None:
        self._result = result

    def charge(self, order_id: int, amount_minor: int) -> ChargeResult:
        return self._result


class MockPaymentGateway:
    """Mock: a hand-rolled expectation. The wrong call fails immediately; the right one is recorded."""

    def __init__(self, expected_order_id: int, expected_amount_minor: int) -> None:
        self._expected_order_id = expected_order_id
        self._expected_amount_minor = expected_amount_minor
        self.called = False

    def charge(self, order_id: int, amount_minor: int) -> ChargeResult:
        if order_id != self._expected_order_id or amount_minor != self._expected_amount_minor:
            raise AssertionError(f"unexpected charge: {order_id} {amount_minor}")
        self.called = True
        return ChargeResult.APPROVED


class SpyMailer:
    """Spy: records what was sent so the test can assert afterwards (state verification)."""

    def __init__(self) -> None:
        self.sent: list[tuple[str, str]] = []

    def send(self, to: str, message: str) -> None:
        self.sent.append((to, message))


def _order(order_id: int = 1, amount_minor: int = 500) -> Order:
    return Order(order_id, "ada@example.com", amount_minor)


def test_after_dummy_audit_logger_is_passed_but_never_called() -> None:
    orders: OrderRepository = InMemoryOrderRepository([_order()])
    use_case = CancelOrder(orders, StubPaymentGateway(ChargeResult.APPROVED), SpyMailer(), NullAuditLogger())
    use_case.execute(1)  # would raise if the dummy were ever invoked


def test_after_stub_gateway_returns_a_canned_decline_and_the_order_is_not_cancelled() -> None:
    orders: OrderRepository = InMemoryOrderRepository([_order()])
    audit = SpyAuditLogger()
    CancelOrder(orders, StubPaymentGateway(ChargeResult.DECLINED), SpyMailer(), audit).execute(1)
    # The stub's canned decline is enough to keep the order out of the cancelled state...
    assert orders.get(1).status == OrderStatus.PENDING
    # ...and it drove a real call to the audit logger, which is no longer dead code.
    assert audit.messages == ["charge declined for order 1"]


def test_after_spy_mailer_records_the_message_it_sent() -> None:
    orders: OrderRepository = InMemoryOrderRepository([_order()])
    mailer: Mailer = SpyMailer()
    CancelOrder(orders, StubPaymentGateway(ChargeResult.APPROVED), mailer, NullAuditLogger()).execute(1)
    assert mailer.sent == [("ada@example.com", "Your order 1 was cancelled")]


def test_after_mock_gateway_fails_immediately_on_the_wrong_charge_but_accepts_the_right_one() -> None:
    wrong_orders: OrderRepository = InMemoryOrderRepository([_order(amount_minor=99900)])
    wrong_gateway: PaymentGateway = MockPaymentGateway(expected_order_id=1, expected_amount_minor=500)
    with pytest.raises(AssertionError, match="unexpected charge"):
        CancelOrder(wrong_orders, wrong_gateway, SpyMailer(), NullAuditLogger()).execute(1)

    orders: OrderRepository = InMemoryOrderRepository([_order()])
    gateway = MockPaymentGateway(expected_order_id=1, expected_amount_minor=500)
    CancelOrder(orders, gateway, SpyMailer(), NullAuditLogger()).execute(1)
    assert gateway.called is True


def test_after_fake_repository_saves_the_cancelled_order() -> None:
    orders = InMemoryOrderRepository([_order()])
    CancelOrder(orders, StubPaymentGateway(ChargeResult.APPROVED), SpyMailer(), NullAuditLogger()).execute(1)
    # Real behaviour: a later read reflects what an earlier write saved. If save() were
    # deleted, get() would still return the untouched copy stored at construction time.
    assert orders.get(1).status == OrderStatus.CANCELLED
