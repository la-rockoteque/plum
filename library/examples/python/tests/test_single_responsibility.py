import pytest

from single_responsibility.after.audit_log import AuditLog
from single_responsibility.after.cancel_order import CancelOrder
from single_responsibility.after.order import Order as AfterOrder
from single_responsibility.after.order import OrderStatus as AfterOrderStatus
from single_responsibility.after.order_notifier import OrderNotifier
from single_responsibility.before import Order as BeforeOrder
from single_responsibility.before import OrderService
from single_responsibility.before import OrderStatus as BeforeOrderStatus


class NotifierSpy:
    """Satisfies CancelOrder's Notifier port; records only (orderId, reason),
    never the wording OrderNotifier produces from it."""

    def __init__(self) -> None:
        self.notified: list[tuple[int, str]] = []

    def notify_cancelled(self, order: AfterOrder, reason: str) -> None:
        self.notified.append((order.id, reason))


class AuditorSpy:
    """Satisfies CancelOrder's Auditor port; records only (orderId, reason),
    never the format AuditLog produces from it."""

    def __init__(self) -> None:
        self.audited: list[tuple[int, str]] = []

    def record_cancelled(self, order: AfterOrder, reason: str) -> None:
        self.audited.append((order.id, reason))


def test_before_cancelling_a_shipped_order_is_rejected() -> None:
    service = OrderService()
    order = BeforeOrder(
        id=1, customer_name="Ada", customer_email="ada@example.com", status=BeforeOrderStatus.SHIPPED
    )
    with pytest.raises(ValueError, match="cannot cancel a shipped or cancelled order"):
        service.cancel(order, "changed my mind")
    assert order.status == BeforeOrderStatus.SHIPPED
    assert service.sent_emails == []
    assert service.audit_log == []


def test_before_cancelling_a_cancelled_order_is_rejected() -> None:
    service = OrderService()
    order = BeforeOrder(
        id=1, customer_name="Ada", customer_email="ada@example.com", status=BeforeOrderStatus.CANCELLED
    )
    with pytest.raises(ValueError, match="cannot cancel a shipped or cancelled order"):
        service.cancel(order, "changed my mind")
    assert order.status == BeforeOrderStatus.CANCELLED
    assert service.sent_emails == []
    assert service.audit_log == []


def test_before_cancelling_a_pending_order_sends_the_confirmation_email() -> None:
    service = OrderService()
    order = BeforeOrder(id=1, customer_name="Ada", customer_email="ada@example.com")
    service.cancel(order, "changed my mind")
    assert order.status == BeforeOrderStatus.CANCELLED
    assert service.sent_emails == [
        "Dear Ada, your order 1 was cancelled. Reason: changed my mind."
    ]


def test_before_cancelling_a_pending_order_writes_an_audit_entry() -> None:
    service = OrderService()
    order = BeforeOrder(id=1, customer_name="Ada", customer_email="ada@example.com")
    service.cancel(order, "changed my mind")
    assert service.audit_log == ["1|CANCELLED|changed my mind"]


def test_before_the_rule_test_is_coupled_to_two_email_wordings() -> None:
    """Change cost: cancel() cannot be exercised without producing the email,
    so the same test that proves the cancellation rule must also pin the
    exact wording — for any reason text. Two reasons, two literal strings,
    one test (this one, not a notifier's) to edit either way."""
    cases = [
        ("changed my mind", "Dear Ada, your order 1 was cancelled. Reason: changed my mind."),
        ("duplicate order", "Dear Ada, your order 1 was cancelled. Reason: duplicate order."),
    ]
    for reason, wording in cases:
        service = OrderService()
        order = BeforeOrder(id=1, customer_name="Ada", customer_email="ada@example.com")
        service.cancel(order, reason)
        assert order.status == BeforeOrderStatus.CANCELLED
        assert service.sent_emails == [wording]


def test_after_cancelling_a_shipped_order_is_rejected_before_notifying_or_auditing() -> None:
    notifier = NotifierSpy()
    audit_log = AuditorSpy()
    use_case = CancelOrder(notifier, audit_log)
    order = AfterOrder(
        id=1, customer_name="Ada", customer_email="ada@example.com", status=AfterOrderStatus.SHIPPED
    )
    with pytest.raises(ValueError, match="cannot cancel a shipped or cancelled order"):
        use_case.execute(order, "changed my mind")
    assert order.status == AfterOrderStatus.SHIPPED
    assert notifier.notified == []
    assert audit_log.audited == []


def test_after_cancelling_a_cancelled_order_is_rejected_before_notifying_or_auditing() -> None:
    notifier = NotifierSpy()
    audit_log = AuditorSpy()
    use_case = CancelOrder(notifier, audit_log)
    order = AfterOrder(
        id=1, customer_name="Ada", customer_email="ada@example.com", status=AfterOrderStatus.CANCELLED
    )
    with pytest.raises(ValueError, match="cannot cancel a shipped or cancelled order"):
        use_case.execute(order, "changed my mind")
    assert order.status == AfterOrderStatus.CANCELLED
    assert notifier.notified == []
    assert audit_log.audited == []


def test_after_cancelling_a_pending_order_notifies_and_audits_through_its_ports() -> None:
    notifier = NotifierSpy()
    audit_log = AuditorSpy()
    use_case = CancelOrder(notifier, audit_log)
    order = AfterOrder(id=1, customer_name="Ada", customer_email="ada@example.com")
    use_case.execute(order, "changed my mind")
    assert order.status == AfterOrderStatus.CANCELLED
    assert notifier.notified == [(1, "changed my mind")]
    assert audit_log.audited == [(1, "changed my mind")]


def test_after_the_notifier_formats_the_cancellation_email_on_its_own() -> None:
    notifier = OrderNotifier()
    order = AfterOrder(id=1, customer_name="Ada", customer_email="ada@example.com")
    notifier.notify_cancelled(order, "changed my mind")
    assert notifier.sent == ["Dear Ada, your order 1 was cancelled. Reason: changed my mind."]


def test_after_the_audit_log_records_the_cancellation_on_its_own() -> None:
    audit_log = AuditLog()
    order = AfterOrder(id=1, customer_name="Ada", customer_email="ada@example.com")
    audit_log.record_cancelled(order, "changed my mind")
    assert audit_log.entries == ["1|CANCELLED|changed my mind"]
