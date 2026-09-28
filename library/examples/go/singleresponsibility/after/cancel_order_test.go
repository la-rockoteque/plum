package after_test

import (
	"errors"
	"testing"

	"example.com/repository-example/singleresponsibility/after"
)

func TestAfter_CancellingAShippedOrderIsRejectedBeforeNotifyingOrAuditing(t *testing.T) {
	notifier := &after.OrderNotifier{}
	auditLog := &after.AuditLog{}
	useCase := after.NewCancelOrder(notifier, auditLog)
	order := &after.Order{ID: "O-1", CustomerName: "Ada", CustomerEmail: "ada@example.com", Status: "shipped"}
	err := useCase.Execute(order, "changed my mind")
	if !errors.Is(err, after.ErrShippedOrder) {
		t.Fatalf("got %v, want shipped order rejection", err)
	}
	if order.Status != "shipped" {
		t.Fatalf("status changed: %s", order.Status)
	}
	if len(notifier.Sent) != 0 || len(auditLog.Entries) != 0 {
		t.Fatalf("side effects on rejection: sent=%v entries=%v", notifier.Sent, auditLog.Entries)
	}
}

func TestAfter_CancellingAPendingOrderNotifiesAndAuditsThroughItsCollaborators(t *testing.T) {
	notifier := &after.OrderNotifier{}
	auditLog := &after.AuditLog{}
	useCase := after.NewCancelOrder(notifier, auditLog)
	order := &after.Order{ID: "O-1", CustomerName: "Ada", CustomerEmail: "ada@example.com", Status: "pending"}
	if err := useCase.Execute(order, "changed my mind"); err != nil {
		t.Fatal(err)
	}
	if order.Status != "cancelled" {
		t.Fatalf("status not updated: %s", order.Status)
	}
	want := "Dear Ada, your order O-1 was cancelled. Reason: changed my mind."
	if len(notifier.Sent) != 1 || notifier.Sent[0] != want {
		t.Fatalf("got %v, want %v", notifier.Sent, want)
	}
	wantEntry := "O-1|CANCELLED|changed my mind"
	if len(auditLog.Entries) != 1 || auditLog.Entries[0] != wantEntry {
		t.Fatalf("got %v, want %v", auditLog.Entries, wantEntry)
	}
}

func TestAfter_TheNotifierFormatsTheCancellationEmailOnItsOwn(t *testing.T) {
	notifier := &after.OrderNotifier{}
	order := &after.Order{ID: "O-1", CustomerName: "Ada", CustomerEmail: "ada@example.com", Status: "pending"}
	notifier.NotifyCancelled(order, "changed my mind")
	want := "Dear Ada, your order O-1 was cancelled. Reason: changed my mind."
	if len(notifier.Sent) != 1 || notifier.Sent[0] != want {
		t.Fatalf("got %v, want %v", notifier.Sent, want)
	}
}

func TestAfter_TheAuditLogRecordsTheCancellationOnItsOwn(t *testing.T) {
	auditLog := &after.AuditLog{}
	order := &after.Order{ID: "O-1", CustomerName: "Ada", CustomerEmail: "ada@example.com", Status: "pending"}
	auditLog.RecordCancelled(order, "changed my mind")
	want := "O-1|CANCELLED|changed my mind"
	if len(auditLog.Entries) != 1 || auditLog.Entries[0] != want {
		t.Fatalf("got %v, want %v", auditLog.Entries, want)
	}
}
