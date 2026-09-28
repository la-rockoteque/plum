package before_test

import (
	"testing"

	"example.com/repository-example/valueobjectsentities/before"
)

func TestBefore_AnInvalidStatusStringIsAccepted(t *testing.T) {
	order := before.Order{ID: 1, Status: "pending", Total: 9.99, Currency: "USD"}
	order.Status = "definitely-not-a-status"
	if order.Status != "definitely-not-a-status" {
		t.Fatalf("got status %q", order.Status)
	}
}

func TestBefore_ACancelledOrderCanBeMovedBackToPending(t *testing.T) {
	order := before.Order{ID: 1, Status: "cancelled", Total: 9.99, Currency: "USD"}
	order.Status = "pending"
	if order.Status != "pending" {
		t.Fatalf("got status %q", order.Status)
	}
}

func TestBefore_TotalsInDifferentCurrenciesAreAddedTogether(t *testing.T) {
	usdOrder := before.Order{ID: 1, Status: "pending", Total: 10.0, Currency: "USD"}
	eurOrder := before.Order{ID: 2, Status: "pending", Total: 5.0, Currency: "EUR"}
	if got := before.AddTotals(usdOrder, eurOrder); got != 15.0 {
		t.Fatalf("got %v, want 15.0", got)
	}
}

func TestBefore_RepeatedFloatAmountsDriftFromTheExactTotal(t *testing.T) {
	orders := []before.Order{
		{ID: 0, Status: "pending", Total: 0.1, Currency: "USD"},
		{ID: 1, Status: "pending", Total: 0.1, Currency: "USD"},
		{ID: 2, Status: "pending", Total: 0.1, Currency: "USD"},
	}
	total := before.AddTotals(orders[0], orders[1]) + orders[2].Total
	if total == 0.3 {
		t.Fatalf("expected float drift, got exact 0.3")
	}
}
