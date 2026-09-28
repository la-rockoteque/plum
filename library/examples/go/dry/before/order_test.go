package before_test

import (
	"testing"

	"example.com/repository-example/dry/before"
)

const nowMs int64 = 10_000_000
const windowMs int64 = 24 * 60 * 60 * 1000

type fixedClock struct{ ms int64 }

func (c fixedClock) NowMs() int64 { return c.ms }

func TestBefore_CliAndApiAgreeAFreshPendingOrderCanBeCancelled(t *testing.T) {
	order := before.Order{ID: 1, Status: before.Pending, PlacedAtMs: nowMs}
	clock := fixedClock{nowMs}
	if !(before.CliCancelHandler{}).CanCancel(order, clock) {
		t.Fatal("cli: want cancellable")
	}
	if !(before.ApiCancelHandler{}).CanCancel(order, clock) {
		t.Fatal("api: want cancellable")
	}
}

func TestBefore_CliAndApiDisagreeOnceTheCancellationWindowHasPassed(t *testing.T) {
	order := before.Order{ID: 1, Status: before.Pending, PlacedAtMs: nowMs - windowMs*2}
	clock := fixedClock{nowMs}
	if (before.CliCancelHandler{}).CanCancel(order, clock) {
		t.Fatal("cli: want not cancellable")
	}
	if !(before.ApiCancelHandler{}).CanCancel(order, clock) {
		t.Fatal("api: want cancellable (the copy-pasted bug)")
	}
}

func TestBefore_NeitherHandlerAllowsCancellingAShippedOrder(t *testing.T) {
	order := before.Order{ID: 1, Status: before.Shipped, PlacedAtMs: nowMs}
	clock := fixedClock{nowMs}
	if (before.CliCancelHandler{}).CanCancel(order, clock) {
		t.Fatal("cli: want not cancellable")
	}
	if (before.ApiCancelHandler{}).CanCancel(order, clock) {
		t.Fatal("api: want not cancellable")
	}
}
