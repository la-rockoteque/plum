package before_test

import (
	"errors"
	"testing"

	"example.com/repository-example/singleresponsibility/before"
)

func TestBefore_CancellingAShippedOrderIsRejected(t *testing.T) {
	service := &before.OrderService{}
	order := &before.Order{ID: 1, CustomerName: "Ada", CustomerEmail: "ada@example.com", Status: before.Shipped}
	err := service.Cancel(order, "changed my mind")
	if !errors.Is(err, before.ErrShippedOrCancelledOrder) {
		t.Fatalf("got %v, want shipped-or-cancelled rejection", err)
	}
	if order.Status != before.Shipped {
		t.Fatalf("status changed: %s", order.Status)
	}
	if len(service.SentEmails) != 0 || len(service.AuditLog) != 0 {
		t.Fatalf("side effects on rejection: emails=%v audit=%v", service.SentEmails, service.AuditLog)
	}
}

func TestBefore_CancellingACancelledOrderIsRejected(t *testing.T) {
	service := &before.OrderService{}
	order := &before.Order{ID: 1, CustomerName: "Ada", CustomerEmail: "ada@example.com", Status: before.Cancelled}
	err := service.Cancel(order, "changed my mind")
	if !errors.Is(err, before.ErrShippedOrCancelledOrder) {
		t.Fatalf("got %v, want shipped-or-cancelled rejection", err)
	}
	if len(service.SentEmails) != 0 || len(service.AuditLog) != 0 {
		t.Fatalf("side effects on rejection: emails=%v audit=%v", service.SentEmails, service.AuditLog)
	}
}

func TestBefore_CancellingAPendingOrderSendsTheConfirmationEmail(t *testing.T) {
	service := &before.OrderService{}
	order := &before.Order{ID: 1, CustomerName: "Ada", CustomerEmail: "ada@example.com", Status: before.Pending}
	if err := service.Cancel(order, "changed my mind"); err != nil {
		t.Fatal(err)
	}
	if order.Status != before.Cancelled {
		t.Fatalf("status not updated: %s", order.Status)
	}
	want := "Dear Ada, your order 1 was cancelled. Reason: changed my mind."
	if len(service.SentEmails) != 1 || service.SentEmails[0] != want {
		t.Fatalf("got %v, want %v", service.SentEmails, want)
	}
}

func TestBefore_CancellingAPendingOrderWritesAnAuditEntry(t *testing.T) {
	service := &before.OrderService{}
	order := &before.Order{ID: 1, CustomerName: "Ada", CustomerEmail: "ada@example.com", Status: before.Pending}
	if err := service.Cancel(order, "changed my mind"); err != nil {
		t.Fatal(err)
	}
	want := "1|CANCELLED|changed my mind"
	if len(service.AuditLog) != 1 || service.AuditLog[0] != want {
		t.Fatalf("got %v, want %v", service.AuditLog, want)
	}
}

// Change cost: Cancel() cannot be exercised without producing the email, so
// the same test that proves the cancellation rule must also pin the exact
// wording — for any reason text. Two reasons, two literal strings, one test
// (this one, not a notifier's) to edit either way.
func TestBefore_TheRuleTestIsCoupledToTwoEmailWordings(t *testing.T) {
	cases := []struct {
		reason string
		want   string
	}{
		{"changed my mind", "Dear Ada, your order 1 was cancelled. Reason: changed my mind."},
		{"duplicate order", "Dear Ada, your order 1 was cancelled. Reason: duplicate order."},
	}
	for _, c := range cases {
		service := &before.OrderService{}
		order := &before.Order{ID: 1, CustomerName: "Ada", CustomerEmail: "ada@example.com", Status: before.Pending}
		if err := service.Cancel(order, c.reason); err != nil {
			t.Fatal(err)
		}
		if order.Status != before.Cancelled {
			t.Fatalf("status not updated: %s", order.Status)
		}
		if len(service.SentEmails) != 1 || service.SentEmails[0] != c.want {
			t.Fatalf("got %v, want %v", service.SentEmails, c.want)
		}
	}
}
