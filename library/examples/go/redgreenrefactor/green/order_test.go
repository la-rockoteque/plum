package green

import "testing"

func TestGreen_CancellingAPendingOrderSucceeds(t *testing.T) {
	order := NewOrder("pending")
	if err := order.Cancel(); err != nil {
		t.Fatal(err)
	}
	if order.Status != "cancelled" {
		t.Fatalf("got status %q, want cancelled", order.Status)
	}
}

func TestGreen_CancellingAShippedOrderIsRejected(t *testing.T) {
	order := NewOrder("shipped")
	if err := order.Cancel(); err == nil {
		t.Fatal("expected an error cancelling a shipped order")
	}
	if order.Status != "shipped" {
		t.Fatalf("got status %q, want shipped", order.Status)
	}
}
