package after_test

import (
	"testing"

	"example.com/repository-example/liskovsubstitution/after"
)

// The same contract body runs against every CancellableOrder subtype.
var cancellableFactories = map[string]func() after.CancellableOrder{
	"standard order":     func() after.CancellableOrder { return after.NewStandardOrder(1, after.Pending) },
	"subscription order": func() after.CancellableOrder { return after.NewSubscriptionOrder(1, after.Pending) },
}

func TestAfter_AnyCancellableOrderCanBeCancelledWhilePending(t *testing.T) {
	for name, factory := range cancellableFactories {
		t.Run(name, func(t *testing.T) {
			order := factory()
			if err := order.Cancel("customer requested"); err != nil {
				t.Fatal(err)
			}
			if order.Status() != after.Cancelled {
				t.Fatalf("got status %q, want cancelled", order.Status())
			}
		})
	}
}

func TestAfter_AnyCancellableOrderRejectsCancellingAnAlreadyCancelledOrder(t *testing.T) {
	for name, factory := range cancellableFactories {
		t.Run(name, func(t *testing.T) {
			order := factory()
			if err := order.Cancel("customer requested"); err != nil {
				t.Fatal(err)
			}
			if err := order.Cancel("customer requested"); err == nil {
				t.Fatal("expected cancelling an already cancelled order to be rejected")
			}
		})
	}
}

func TestAfter_TheExpiredOrdersBatchCancelsEveryCancellableOrderWithoutCheckingItsType(t *testing.T) {
	batch := after.CancelExpiredOrders{}
	standard := after.NewStandardOrder(1, after.Pending)
	subscription := after.NewSubscriptionOrder(2, after.Pending)
	cancelled := batch.Execute([]after.CancellableOrder{standard, subscription}, "expired")
	if len(cancelled) != 2 || cancelled[0] != 1 || cancelled[1] != 2 {
		t.Fatalf("got cancelled %v, want [1 2]", cancelled)
	}
	if standard.Status() != after.Cancelled {
		t.Fatalf("standard status %s, want cancelled", standard.Status())
	}
	if subscription.Status() != after.Cancelled {
		t.Fatalf("subscription status %s, want cancelled", subscription.Status())
	}
}

func TestAfter_TheCustomerServiceToolCancelsAnyCancellableOrderWithoutCheckingItsType(t *testing.T) {
	tool := after.CustomerServiceCancelTool{}
	standard := after.NewStandardOrder(1, after.Pending)
	subscription := after.NewSubscriptionOrder(2, after.Pending)
	msg, err := tool.Cancel(standard, "changed my mind")
	if err != nil {
		t.Fatal(err)
	}
	if msg != "order 1 cancelled: changed my mind" {
		t.Fatalf("got %q, want %q", msg, "order 1 cancelled: changed my mind")
	}
	msg, err = tool.Cancel(subscription, "changed my mind")
	if err != nil {
		t.Fatal(err)
	}
	if msg != "order 2 cancelled: changed my mind" {
		t.Fatalf("got %q, want %q", msg, "order 2 cancelled: changed my mind")
	}
}

// A gift order shares the base Order shape but was never given a Cancel
// method, so it doesn't satisfy CancellableOrder — proven here by a failed
// type assertion, the strongest guarantee Go can give: this isn't checked at
// runtime by a caller, it can't compile into a []CancellableOrder at all.
func TestAfter_AGiftOrderDoesNotSatisfyTheCancellableOrderContract(t *testing.T) {
	var order after.Order = after.NewGiftOrder(1, after.Pending)
	if _, ok := order.(after.CancellableOrder); ok {
		t.Fatal("gift order must not satisfy CancellableOrder")
	}
	var standard after.Order = after.NewStandardOrder(1, after.Pending)
	if _, ok := standard.(after.CancellableOrder); !ok {
		t.Fatal("standard order must satisfy CancellableOrder")
	}
}
