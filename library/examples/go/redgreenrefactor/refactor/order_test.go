package refactor

import "testing"

func TestRefactor_CancellingAPendingOrderSucceeds(t *testing.T) {
	// Same case as green, run against the refactored design.
	order := NewOrder(Pending)
	if err := order.Cancel(); err != nil {
		t.Fatal(err)
	}
	if order.Status != Cancelled {
		t.Fatalf("got status %q, want cancelled", order.Status)
	}
}

func TestRefactor_CancellingAShippedOrderIsRejected(t *testing.T) {
	// Same case as green, run against the refactored design.
	order := NewOrder(Shipped)
	if err := order.Cancel(); err == nil {
		t.Fatal("expected an error cancelling a shipped order")
	}
	if order.Status != Shipped {
		t.Fatalf("got status %q, want shipped", order.Status)
	}
}
