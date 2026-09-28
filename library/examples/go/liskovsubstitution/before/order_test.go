package before_test

import (
	"errors"
	"testing"

	"example.com/repository-example/liskovsubstitution/before"
)

func TestBefore_APendingOrderCanBeCancelled(t *testing.T) {
	order := before.NewStandardOrder(1, before.Pending)
	if err := order.Cancel("customer requested"); err != nil {
		t.Fatal(err)
	}
	if order.Status() != before.Cancelled {
		t.Fatalf("got status %q, want cancelled", order.Status())
	}
}

// The precondition GiftOrder accepts is stricter than Order's: Order allows
// cancelling while pending, GiftOrder never does. That's the LSP violation.
func TestBefore_AGiftOrderRejectsCancellationEvenWhilePending(t *testing.T) {
	gift := before.NewGiftOrder(1, before.Pending)
	err := gift.Cancel("customer requested")
	if !errors.Is(err, before.ErrGiftOrdersCannotBeCancelledOnline) {
		t.Fatalf("got %v, want gift-orders-cannot-be-cancelled rejection", err)
	}
	if gift.Status() != before.Pending {
		t.Fatalf("status changed: %s", gift.Status())
	}
}

func TestBefore_TheExpiredOrdersBatchMustSkipGiftOrdersToAvoidTheBrokenContract(t *testing.T) {
	batch := before.CancelExpiredOrders{}
	standard := before.NewStandardOrder(1, before.Pending)
	gift := before.NewGiftOrder(2, before.Pending)
	cancelled, skipped := batch.Execute([]before.Order{standard, gift}, "expired")
	if len(cancelled) != 1 || cancelled[0] != 1 {
		t.Fatalf("got cancelled %v, want [1]", cancelled)
	}
	if len(skipped) != 1 || skipped[0] != 2 {
		t.Fatalf("got skipped %v, want [2]", skipped)
	}
	if standard.Status() != before.Cancelled {
		t.Fatalf("standard status %s, want cancelled", standard.Status())
	}
	if gift.Status() != before.Pending {
		t.Fatalf("gift status %s, want pending", gift.Status())
	}
}

func TestBefore_TheCustomerServiceToolMustSpecialCaseGiftOrdersToAvoidTheBrokenContract(t *testing.T) {
	tool := before.CustomerServiceCancelTool{}
	standard := before.NewStandardOrder(1, before.Pending)
	gift := before.NewGiftOrder(2, before.Pending)
	msg, err := tool.Cancel(standard, "changed my mind")
	if err != nil {
		t.Fatal(err)
	}
	if msg != "order 1 cancelled: changed my mind" {
		t.Fatalf("got %q, want %q", msg, "order 1 cancelled: changed my mind")
	}
	if standard.Status() != before.Cancelled {
		t.Fatalf("standard status %s, want cancelled", standard.Status())
	}
	_, err = tool.Cancel(gift, "changed my mind")
	if !errors.Is(err, before.ErrGiftOrdersCannotBeCancelledOnline) {
		t.Fatalf("got %v, want gift-orders-cannot-be-cancelled rejection", err)
	}
	if gift.Status() != before.Pending {
		t.Fatalf("gift status %s, want pending", gift.Status())
	}
}
