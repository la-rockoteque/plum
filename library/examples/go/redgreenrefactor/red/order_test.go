package red

import "testing"

func TestRed_CancellingAShippedOrderIsStillAllowed(t *testing.T) {
	// The new rule doesn't exist yet: this passing test pins the flaw it will fix.
	order := NewOrder("shipped")
	order.Cancel()
	if order.Status != "cancelled" {
		t.Fatalf("got status %q, want cancelled", order.Status)
	}
}
