package after_test

import (
	"testing"

	"example.com/repository-example/yagnikiss/after"
)

const nowMs int64 = 10_000_000
const windowMs int64 = 24 * 60 * 60 * 1000

type fixedClock struct{ ms int64 }

func (c fixedClock) NowMs() int64 { return c.ms }

func TestAfter_AFreshPendingOrderCanBeCancelled(t *testing.T) {
	order := after.Order{ID: 1, Status: after.Pending, PlacedAtMs: nowMs}
	clock := fixedClock{nowMs}
	if !order.CanBeCancelled(clock) {
		t.Fatal("want cancellable")
	}
}

func TestAfter_AnOrderPastTheCancellationWindowCannotBeCancelled(t *testing.T) {
	order := after.Order{ID: 1, Status: after.Pending, PlacedAtMs: nowMs - windowMs*2}
	clock := fixedClock{nowMs}
	if order.CanBeCancelled(clock) {
		t.Fatal("want not cancellable")
	}
}

func TestAfter_AShippedOrderCannotBeCancelled(t *testing.T) {
	order := after.Order{ID: 1, Status: after.Shipped, PlacedAtMs: nowMs}
	clock := fixedClock{nowMs}
	if order.CanBeCancelled(clock) {
		t.Fatal("want not cancellable")
	}
}
