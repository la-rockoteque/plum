package after_test

import (
	"errors"
	"testing"

	"example.com/repository-example/valueobjectsentities/after"
)

func TestAfter_ConstructingAnOrderWithAnUnknownStatusIsRejected(t *testing.T) {
	_, err := after.ParseOrderStatus("definitely-not-a-status")
	if !errors.Is(err, after.ErrInvalidStatusTransition) {
		t.Fatalf("got %v, want invalid status transition", err)
	}
}

func TestAfter_CancellingACancelledOrderIsRejected(t *testing.T) {
	order := after.Order{ID: 1, Status: after.Pending, Total: after.Money{AmountMinor: 999, Currency: "USD"}}
	if err := order.Cancel(); err != nil {
		t.Fatalf("first cancel failed: %v", err)
	}
	if err := order.Cancel(); !errors.Is(err, after.ErrInvalidStatusTransition) {
		t.Fatalf("got %v, want invalid status transition", err)
	}
}

func TestAfter_ACancelledOrderCannotMoveBackToPending(t *testing.T) {
	order := after.Order{ID: 1, Status: after.Pending, Total: after.Money{AmountMinor: 999, Currency: "USD"}}
	if err := order.Cancel(); err != nil {
		t.Fatalf("cancel failed: %v", err)
	}
	if _, err := order.Status.TransitionTo(after.Pending); !errors.Is(err, after.ErrInvalidStatusTransition) {
		t.Fatalf("got %v, want invalid status transition", err)
	}
}

func TestAfter_AddingMoneyInDifferentCurrenciesIsRejected(t *testing.T) {
	usd := after.Money{AmountMinor: 1000, Currency: "USD"}
	eur := after.Money{AmountMinor: 500, Currency: "EUR"}
	if _, err := usd.Add(eur); !errors.Is(err, after.ErrCurrencyMismatch) {
		t.Fatalf("got %v, want currency mismatch", err)
	}
}

func TestAfter_RepeatedMoneyAmountsDoNotDrift(t *testing.T) {
	ten := after.Money{AmountMinor: 10, Currency: "USD"}
	step1, err := ten.Add(ten)
	if err != nil {
		t.Fatalf("add failed: %v", err)
	}
	total, err := step1.Add(ten)
	if err != nil {
		t.Fatalf("add failed: %v", err)
	}
	want := after.Money{AmountMinor: 30, Currency: "USD"}
	if total != want {
		t.Fatalf("got %+v, want %+v", total, want)
	}
}

func TestAfter_MoneyWithEqualAmountAndCurrencyIsEqualByValue(t *testing.T) {
	a := after.Money{AmountMinor: 1000, Currency: "USD"}
	b := after.Money{AmountMinor: 1000, Currency: "USD"}
	c := after.Money{AmountMinor: 1000, Currency: "EUR"}
	if a != b {
		t.Fatalf("expected %+v == %+v", a, b)
	}
	if a == c {
		t.Fatalf("expected %+v != %+v", a, c)
	}
}

func TestAfter_MoneyIsImmutable(t *testing.T) {
	a := after.Money{AmountMinor: 1000, Currency: "USD"}
	b := after.Money{AmountMinor: 500, Currency: "USD"}
	c, err := a.Add(b)
	if err != nil {
		t.Fatalf("add failed: %v", err)
	}
	if a != (after.Money{AmountMinor: 1000, Currency: "USD"}) {
		t.Fatalf("operand a mutated: %+v", a)
	}
	if c != (after.Money{AmountMinor: 1500, Currency: "USD"}) {
		t.Fatalf("got %+v", c)
	}
}

func TestAfter_TwoOrdersWithEqualFieldsButDifferentIdsAreNotEqual(t *testing.T) {
	total := after.Money{AmountMinor: 500, Currency: "USD"}
	orderA := after.Order{ID: 1, Status: after.Pending, Total: total}
	orderB := after.Order{ID: 2, Status: after.Pending, Total: total}
	if orderA.Equals(orderB) {
		t.Fatalf("expected orders with different ids to be unequal")
	}

	orderC := after.Order{ID: 1, Status: after.Pending, Total: total}
	if err := orderC.Cancel(); err != nil {
		t.Fatalf("cancel failed: %v", err)
	}
	if !orderA.Equals(orderC) {
		t.Fatalf("expected orders with the same id to be equal despite differing attributes")
	}
}
