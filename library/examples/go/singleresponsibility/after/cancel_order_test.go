package after_test

import (
	"errors"
	"testing"

	"example.com/repository-example/singleresponsibility/after"
)

// notifierSpy satisfies CancelOrder's Notifier port; it records only
// (orderId, reason), never the wording OrderNotifier produces from it.
type notifierSpy struct {
	notified []struct {
		orderID int
		reason  string
	}
}

func (n *notifierSpy) NotifyCancelled(order *after.Order, reason string) {
	n.notified = append(n.notified, struct {
		orderID int
		reason  string
	}{order.ID, reason})
}

// auditorSpy satisfies CancelOrder's Auditor port; it records only
// (orderId, reason), never the format AuditLog produces from it.
type auditorSpy struct {
	audited []struct {
		orderID int
		reason  string
	}
}

func (a *auditorSpy) RecordCancelled(order *after.Order, reason string) {
	a.audited = append(a.audited, struct {
		orderID int
		reason  string
	}{order.ID, reason})
}

func TestAfter_CancellingAShippedOrderIsRejectedBeforeNotifyingOrAuditing(t *testing.T) {
	notifier := &notifierSpy{}
	auditLog := &auditorSpy{}
	useCase := after.NewCancelOrder(notifier, auditLog)
	order := &after.Order{ID: 1, CustomerName: "Ada", CustomerEmail: "ada@example.com", Status: after.Shipped}
	err := useCase.Execute(order, "changed my mind")
	if !errors.Is(err, after.ErrShippedOrCancelledOrder) {
		t.Fatalf("got %v, want shipped-or-cancelled rejection", err)
	}
	if order.Status != after.Shipped {
		t.Fatalf("status changed: %s", order.Status)
	}
	if len(notifier.notified) != 0 || len(auditLog.audited) != 0 {
		t.Fatalf("side effects on rejection: notified=%v audited=%v", notifier.notified, auditLog.audited)
	}
}

func TestAfter_CancellingACancelledOrderIsRejectedBeforeNotifyingOrAuditing(t *testing.T) {
	notifier := &notifierSpy{}
	auditLog := &auditorSpy{}
	useCase := after.NewCancelOrder(notifier, auditLog)
	order := &after.Order{ID: 1, CustomerName: "Ada", CustomerEmail: "ada@example.com", Status: after.Cancelled}
	err := useCase.Execute(order, "changed my mind")
	if !errors.Is(err, after.ErrShippedOrCancelledOrder) {
		t.Fatalf("got %v, want shipped-or-cancelled rejection", err)
	}
	if len(notifier.notified) != 0 || len(auditLog.audited) != 0 {
		t.Fatalf("side effects on rejection: notified=%v audited=%v", notifier.notified, auditLog.audited)
	}
}

func TestAfter_CancellingAPendingOrderNotifiesAndAuditsThroughItsPorts(t *testing.T) {
	notifier := &notifierSpy{}
	auditLog := &auditorSpy{}
	useCase := after.NewCancelOrder(notifier, auditLog)
	order := &after.Order{ID: 1, CustomerName: "Ada", CustomerEmail: "ada@example.com", Status: after.Pending}
	if err := useCase.Execute(order, "changed my mind"); err != nil {
		t.Fatal(err)
	}
	if order.Status != after.Cancelled {
		t.Fatalf("status not updated: %s", order.Status)
	}
	if len(notifier.notified) != 1 || notifier.notified[0].orderID != 1 || notifier.notified[0].reason != "changed my mind" {
		t.Fatalf("got %v, want [(1, changed my mind)]", notifier.notified)
	}
	if len(auditLog.audited) != 1 || auditLog.audited[0].orderID != 1 || auditLog.audited[0].reason != "changed my mind" {
		t.Fatalf("got %v, want [(1, changed my mind)]", auditLog.audited)
	}
}

func TestAfter_TheNotifierFormatsTheCancellationEmailOnItsOwn(t *testing.T) {
	notifier := &after.OrderNotifier{}
	order := &after.Order{ID: 1, CustomerName: "Ada", CustomerEmail: "ada@example.com", Status: after.Pending}
	notifier.NotifyCancelled(order, "changed my mind")
	want := "Dear Ada, your order 1 was cancelled. Reason: changed my mind."
	if len(notifier.Sent) != 1 || notifier.Sent[0] != want {
		t.Fatalf("got %v, want %v", notifier.Sent, want)
	}
}

func TestAfter_TheAuditLogRecordsTheCancellationOnItsOwn(t *testing.T) {
	auditLog := &after.AuditLog{}
	order := &after.Order{ID: 1, CustomerName: "Ada", CustomerEmail: "ada@example.com", Status: after.Pending}
	auditLog.RecordCancelled(order, "changed my mind")
	want := "1|CANCELLED|changed my mind"
	if len(auditLog.Entries) != 1 || auditLog.Entries[0] != want {
		t.Fatalf("got %v, want %v", auditLog.Entries, want)
	}
}
