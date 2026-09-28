package before_test

import (
	"testing"

	"example.com/repository-example/yagnikiss/before"
)

const nowMs int64 = 10_000_000
const windowMs int64 = 24 * 60 * 60 * 1000

type fixedClock struct{ ms int64 }

func (c fixedClock) NowMs() int64 { return c.ms }

func TestBefore_AFreshPendingOrderCanBeCancelled(t *testing.T) {
	order := before.Order{ID: 1, Status: before.Pending, PlacedAtMs: nowMs}
	clock := fixedClock{nowMs}
	service := before.NewOrderCancellationService("", nil)
	if !service.CanCancel(order, clock) {
		t.Fatal("want cancellable")
	}
}

func TestBefore_AnOrderPastTheCancellationWindowCannotBeCancelled(t *testing.T) {
	order := before.Order{ID: 1, Status: before.Pending, PlacedAtMs: nowMs - windowMs*2}
	clock := fixedClock{nowMs}
	service := before.NewOrderCancellationService("", nil)
	if service.CanCancel(order, clock) {
		t.Fatal("want not cancellable")
	}
}

func TestBefore_AShippedOrderCannotBeCancelled(t *testing.T) {
	order := before.Order{ID: 1, Status: before.Shipped, PlacedAtMs: nowMs}
	clock := fixedClock{nowMs}
	service := before.NewOrderCancellationService("", nil)
	if service.CanCancel(order, clock) {
		t.Fatal("want not cancellable")
	}
}

func TestBefore_ATypoInThePolicyConfigNameSilentlyFallsBackToTheDefaultPolicy(t *testing.T) {
	order := before.Order{ID: 1, Status: before.Pending, PlacedAtMs: nowMs}
	clock := fixedClock{nowMs}
	correctlyNamed := before.NewOrderCancellationService("standard", nil)
	typoNamed := before.NewOrderCancellationService("stadnard", nil)
	if typoNamed.CanCancel(order, clock) != correctlyNamed.CanCancel(order, clock) {
		t.Fatal("want the typo to silently fall back to the same decision as the default policy")
	}
}

func TestBefore_TheUnusedCancellationHooksAreEmptyByDefault(t *testing.T) {
	service := before.NewOrderCancellationService("", nil)
	if len(service.Hooks.OnBeforeCancel) != 0 || len(service.Hooks.OnAfterCancel) != 0 {
		t.Fatal("want no hooks wired by default")
	}
}
