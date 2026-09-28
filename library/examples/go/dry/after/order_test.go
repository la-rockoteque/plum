package after_test

import (
	"testing"

	"example.com/repository-example/dry/after"
)

const nowMs int64 = 10_000_000
const windowMs int64 = 24 * 60 * 60 * 1000

type fixedClock struct{ ms int64 }

func (c fixedClock) NowMs() int64 { return c.ms }

func TestAfter_CliAndApiAgreeAFreshPendingOrderCanBeCancelled(t *testing.T) {
	order := after.Order{ID: 1, Status: after.Pending, PlacedAtMs: nowMs}
	clock := fixedClock{nowMs}
	if !(after.CliCancelHandler{}).CanCancel(order, clock) {
		t.Fatal("cli: want cancellable")
	}
	if !(after.ApiCancelHandler{}).CanCancel(order, clock) {
		t.Fatal("api: want cancellable")
	}
}

func TestAfter_CliAndApiAgreeOnceTheCancellationWindowHasPassed(t *testing.T) {
	order := after.Order{ID: 1, Status: after.Pending, PlacedAtMs: nowMs - windowMs*2}
	clock := fixedClock{nowMs}
	if (after.CliCancelHandler{}).CanCancel(order, clock) {
		t.Fatal("cli: want not cancellable")
	}
	if (after.ApiCancelHandler{}).CanCancel(order, clock) {
		t.Fatal("api: want not cancellable")
	}
}

func TestAfter_NeitherHandlerAllowsCancellingAShippedOrder(t *testing.T) {
	order := after.Order{ID: 1, Status: after.Shipped, PlacedAtMs: nowMs}
	clock := fixedClock{nowMs}
	if (after.CliCancelHandler{}).CanCancel(order, clock) {
		t.Fatal("cli: want not cancellable")
	}
	if (after.ApiCancelHandler{}).CanCancel(order, clock) {
		t.Fatal("api: want not cancellable")
	}
}
