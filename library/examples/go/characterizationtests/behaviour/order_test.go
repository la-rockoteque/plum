// Package behaviour_test lives on its own (not inside legacy or refactored) purely to import both
// without a cycle, and pins the current, sometimes-odd behaviour of ComputeRefund in both.
package behaviour_test

import (
	"testing"

	"example.com/repository-example/characterizationtests/legacy"
	"example.com/repository-example/characterizationtests/refactored"
)

const (
	msPerDay = 24 * 60 * 60 * 1000
	todayMs  = 1_700_000_000_000
)

func TestBefore_NobodyKnowsWhatComputeRefundDoesForMostInputs(t *testing.T) {
	// The starting point of legacy work: one sample input pinned, nothing more understood yet.
	order := legacy.Order{OrderID: 1, AmountMinor: 10_000, PurchasedAtMs: todayMs - 5*msPerDay, Status: "active"}
	if got := legacy.ComputeRefund(order, todayMs); got != 10_000 {
		t.Fatalf("got %d, want 10000", got)
	}
}

func TestCurrently_AHoldOrderRefundsZeroRegardlessOfAge(t *testing.T) {
	amountMinor, purchasedAtMs, status := int64(10_000), int64(todayMs-5*msPerDay), "hold"
	l := legacy.Order{OrderID: 2, AmountMinor: amountMinor, PurchasedAtMs: purchasedAtMs, Status: status}
	r := refactored.Order{OrderID: 2, AmountMinor: amountMinor, PurchasedAtMs: purchasedAtMs, Status: status}
	if got := legacy.ComputeRefund(l, todayMs); got != 0 {
		t.Fatalf("legacy: got %d, want 0", got)
	}
	if got := refactored.ComputeRefund(r, todayMs); got != 0 {
		t.Fatalf("refactored: got %d, want 0", got)
	}
}

func TestCurrently_AnOrderExactly14DaysOldGetsAFullRefund(t *testing.T) {
	amountMinor, purchasedAtMs, status := int64(10_000), int64(todayMs-14*msPerDay), "active"
	l := legacy.Order{OrderID: 3, AmountMinor: amountMinor, PurchasedAtMs: purchasedAtMs, Status: status}
	r := refactored.Order{OrderID: 3, AmountMinor: amountMinor, PurchasedAtMs: purchasedAtMs, Status: status}
	if got := legacy.ComputeRefund(l, todayMs); got != 10_000 {
		t.Fatalf("legacy: got %d, want 10000", got)
	}
	if got := refactored.ComputeRefund(r, todayMs); got != 10_000 {
		t.Fatalf("refactored: got %d, want 10000", got)
	}
}

func TestCurrently_AnOrder15DaysOldRefunds90Percent(t *testing.T) {
	amountMinor, purchasedAtMs, status := int64(10_000), int64(todayMs-15*msPerDay), "active"
	l := legacy.Order{OrderID: 4, AmountMinor: amountMinor, PurchasedAtMs: purchasedAtMs, Status: status}
	r := refactored.Order{OrderID: 4, AmountMinor: amountMinor, PurchasedAtMs: purchasedAtMs, Status: status}
	if got := legacy.ComputeRefund(l, todayMs); got != 9_000 {
		t.Fatalf("legacy: got %d, want 9000", got)
	}
	if got := refactored.ComputeRefund(r, todayMs); got != 9_000 {
		t.Fatalf("refactored: got %d, want 9000", got)
	}
}

func TestCurrently_AnOrderExactly30DaysOldIsNotRoundedDown(t *testing.T) {
	amountMinor, purchasedAtMs, status := int64(10_050), int64(todayMs-30*msPerDay), "active"
	l := legacy.Order{OrderID: 5, AmountMinor: amountMinor, PurchasedAtMs: purchasedAtMs, Status: status}
	r := refactored.Order{OrderID: 5, AmountMinor: amountMinor, PurchasedAtMs: purchasedAtMs, Status: status}
	if got := legacy.ComputeRefund(l, todayMs); got != 9_045 {
		t.Fatalf("legacy: got %d, want 9045", got)
	}
	if got := refactored.ComputeRefund(r, todayMs); got != 9_045 {
		t.Fatalf("refactored: got %d, want 9045", got)
	}
}

func TestCurrently_AnOrderOlderThan30DaysRoundsTheRefundDownToTheNearestHundred(t *testing.T) {
	amountMinor, purchasedAtMs, status := int64(10_050), int64(todayMs-31*msPerDay), "active"
	l := legacy.Order{OrderID: 6, AmountMinor: amountMinor, PurchasedAtMs: purchasedAtMs, Status: status}
	r := refactored.Order{OrderID: 6, AmountMinor: amountMinor, PurchasedAtMs: purchasedAtMs, Status: status}
	if got := legacy.ComputeRefund(l, todayMs); got != 9_000 {
		t.Fatalf("legacy: got %d, want 9000", got)
	}
	if got := refactored.ComputeRefund(r, todayMs); got != 9_000 {
		t.Fatalf("refactored: got %d, want 9000", got)
	}
}
