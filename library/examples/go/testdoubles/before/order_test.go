package before

import (
	"strings"
	"testing"
)

func TestBefore_CancellingAnOrderBlowsUpInsteadOfCompleting(t *testing.T) {
	order := NewOrder(1, "ada@example.com", 500)
	err := CancelOrder{}.Execute(order)
	if err == nil || !strings.Contains(err.Error(), "network unavailable") {
		t.Fatalf("got error %v, want network unavailable", err)
	}
	// Nothing about the business outcome is observable: the order never even changed status.
	if order.Status != "pending" {
		t.Fatalf("got status %q, want pending", order.Status)
	}
}
