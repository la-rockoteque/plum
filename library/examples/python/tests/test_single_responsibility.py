import pytest

from single_responsibility.after.audit_log import AuditLog
from single_responsibility.after.cancel_order import CancelOrder
from single_responsibility.after.order import Order as AfterOrder
from single_responsibility.after.order_notifier import OrderNotifier
from single_responsibility.before import Order as BeforeOrder, OrderService


def test_before_cancelling_a_shipped_order_is_rejected() -> None:
    service = OrderService()
    order = BeforeOrder(id="O-1", customer_name="Ada", customer_email="ada@example.com", status="shipped")
    with pytest.raises(ValueError, match="cannot cancel a shipped order"):
        service.cancel(order, "changed my mind")
    assert order.status == "shipped"
    assert service.sent_emails == []
    assert service.audit_log == []


def test_before_cancelling_a_pending_order_sends_the_confirmation_email() -> None:
    service = OrderService()
    order = BeforeOrder(id="O-1", customer_name="Ada", customer_email="ada@example.com")
    service.cancel(order, "changed my mind")
    assert order.status == "cancelled"
    assert service.sent_emails == [
        "Dear Ada, your order O-1 was cancelled. Reason: changed my mind."
    ]


def test_before_cancelling_a_pending_order_writes_an_audit_entry() -> None:
    service = OrderService()
    order = BeforeOrder(id="O-1", customer_name="Ada", customer_email="ada@example.com")
    service.cancel(order, "changed my mind")
    assert service.audit_log == ["O-1|CANCELLED|changed my mind"]


def test_after_cancelling_a_shipped_order_is_rejected_before_notifying_or_auditing() -> None:
    notifier = OrderNotifier()
    audit_log = AuditLog()
    use_case = CancelOrder(notifier, audit_log)
    order = AfterOrder(id="O-1", customer_name="Ada", customer_email="ada@example.com", status="shipped")
    with pytest.raises(ValueError, match="cannot cancel a shipped order"):
        use_case.execute(order, "changed my mind")
    assert order.status == "shipped"
    assert notifier.sent == []
    assert audit_log.entries == []


def test_after_cancelling_a_pending_order_notifies_and_audits_through_its_collaborators() -> None:
    notifier = OrderNotifier()
    audit_log = AuditLog()
    use_case = CancelOrder(notifier, audit_log)
    order = AfterOrder(id="O-1", customer_name="Ada", customer_email="ada@example.com")
    use_case.execute(order, "changed my mind")
    assert order.status == "cancelled"
    assert notifier.sent == ["Dear Ada, your order O-1 was cancelled. Reason: changed my mind."]
    assert audit_log.entries == ["O-1|CANCELLED|changed my mind"]


def test_after_the_notifier_formats_the_cancellation_email_on_its_own() -> None:
    notifier = OrderNotifier()
    order = AfterOrder(id="O-1", customer_name="Ada", customer_email="ada@example.com")
    notifier.notify_cancelled(order, "changed my mind")
    assert notifier.sent == ["Dear Ada, your order O-1 was cancelled. Reason: changed my mind."]


def test_after_the_audit_log_records_the_cancellation_on_its_own() -> None:
    audit_log = AuditLog()
    order = AfterOrder(id="O-1", customer_name="Ada", customer_email="ada@example.com")
    audit_log.record_cancelled(order, "changed my mind")
    assert audit_log.entries == ["O-1|CANCELLED|changed my mind"]
