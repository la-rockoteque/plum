package before_test

import (
	"errors"
	"testing"

	"example.com/repository-example/singleresponsibility/before"
)

func TestBefore_CancellingAShippedOrderIsRejected(t *testing.T) {
	service := &before.OrderService{}
	order := &before.Order{ID: "O-1", CustomerName: "Ada", CustomerEmail: "ada@example.com", Status: "shipped"}
	err := service.Cancel(order, "changed my mind")
	if !errors.Is(err, before.ErrShippedOrder) {
		t.Fatalf("got %v, want shipped order rejection", err)
	}
	if order.Status != "shipped" {
		t.Fatalf("status changed: %s", order.Status)
	}
	if len(service.SentEmails) != 0 || len(service.AuditLog) != 0 {
		t.Fatalf("side effects on rejection: emails=%v audit=%v", service.SentEmails, service.AuditLog)
	}
}

func TestBefore_CancellingAPendingOrderSendsTheConfirmationEmail(t *testing.T) {
	service := &before.OrderService{}
	order := &before.Order{ID: "O-1", CustomerName: "Ada", CustomerEmail: "ada@example.com", Status: "pending"}
	if err := service.Cancel(order, "changed my mind"); err != nil {
		t.Fatal(err)
	}
	if order.Status != "cancelled" {
		t.Fatalf("status not updated: %s", order.Status)
	}
	want := "Dear Ada, your order O-1 was cancelled. Reason: changed my mind."
	if len(service.SentEmails) != 1 || service.SentEmails[0] != want {
		t.Fatalf("got %v, want %v", service.SentEmails, want)
	}
}

func TestBefore_CancellingAPendingOrderWritesAnAuditEntry(t *testing.T) {
	service := &before.OrderService{}
	order := &before.Order{ID: "O-1", CustomerName: "Ada", CustomerEmail: "ada@example.com", Status: "pending"}
	if err := service.Cancel(order, "changed my mind"); err != nil {
		t.Fatal(err)
	}
	want := "O-1|CANCELLED|changed my mind"
	if len(service.AuditLog) != 1 || service.AuditLog[0] != want {
		t.Fatalf("got %v, want %v", service.AuditLog, want)
	}
}
