package after_test

import (
	"errors"
	"testing"

	"example.com/repository-example/aggregates/after"
)

func TestAfter_AddingALineUpdatesTheTotalImmediately(t *testing.T) {
	order := after.NewOrder(1, after.Pending)
	if _, err := order.AddLine("WIDGET", 2, 500, "USD"); err != nil {
		t.Fatalf("add line failed: %v", err)
	}
	if got := order.TotalMinor(); got != 1000 {
		t.Fatalf("got total %d, want 1000", got)
	}
}

func TestAfter_AnEleventhLineIsRejected(t *testing.T) {
	order := after.NewOrder(1, after.Pending)
	for i := 0; i < 10; i++ {
		if _, err := order.AddLine("SKU", 1, 100, "USD"); err != nil {
			t.Fatalf("add line failed: %v", err)
		}
	}
	if _, err := order.AddLine("SKU", 1, 100, "USD"); !errors.Is(err, after.ErrTooManyLines) {
		t.Fatalf("got %v, want too many lines", err)
	}
}

func TestAfter_ChangingALinesQuantityToZeroIsRejected(t *testing.T) {
	order := after.NewOrder(1, after.Pending)
	lineID, err := order.AddLine("WIDGET", 2, 500, "USD")
	if err != nil {
		t.Fatalf("add line failed: %v", err)
	}
	if err := order.ChangeQuantity(lineID, 0); !errors.Is(err, after.ErrInvalidQuantity) {
		t.Fatalf("got %v, want invalid quantity", err)
	}
}

func TestAfter_ChangingALineOnACancelledOrderIsRejected(t *testing.T) {
	order := after.NewOrder(1, after.Pending)
	lineID, err := order.AddLine("WIDGET", 2, 500, "USD")
	if err != nil {
		t.Fatalf("add line failed: %v", err)
	}
	if err := order.Cancel(); err != nil {
		t.Fatalf("cancel failed: %v", err)
	}
	if err := order.ChangeQuantity(lineID, 3); !errors.Is(err, after.ErrOrderCancelled) {
		t.Fatalf("got %v, want order cancelled", err)
	}
}

func TestAfter_CancellingAShippedOrAlreadyCancelledOrderIsRejected(t *testing.T) {
	shipped := after.NewOrder(1, after.Shipped)
	if err := shipped.Cancel(); !errors.Is(err, after.ErrOrderCancelled) {
		t.Fatalf("got %v, want order cancelled (shipped)", err)
	}

	cancelled := after.NewOrder(2, after.Cancelled)
	if err := cancelled.Cancel(); !errors.Is(err, after.ErrOrderCancelled) {
		t.Fatalf("got %v, want order cancelled (already cancelled)", err)
	}
}

func TestAfter_AddingALineInAnotherCurrencyIsRejected(t *testing.T) {
	order := after.NewOrder(1, after.Pending)
	if _, err := order.AddLine("WIDGET", 1, 500, "EUR"); !errors.Is(err, after.ErrCurrencyMismatch) {
		t.Fatalf("got %v, want currency mismatch", err)
	}
}

func TestAfter_TheLinesReturnedByTheOrderAreCopiesThatCannotMutateIt(t *testing.T) {
	order := after.NewOrder(1, after.Pending)
	if _, err := order.AddLine("WIDGET", 2, 500, "USD"); err != nil {
		t.Fatalf("add line failed: %v", err)
	}
	fetched := order.Lines()
	fetched[0].Quantity = 99
	if got := order.Lines()[0].Quantity; got != 2 {
		t.Fatalf("got quantity %d, want 2 (unaffected by copy mutation)", got)
	}
	if got := order.TotalMinor(); got != 1000 {
		t.Fatalf("got total %d, want 1000", got)
	}
}

func TestAfter_TheRepositorySavesAndLoadsTheWholeOrder(t *testing.T) {
	order := after.NewOrder(1, after.Pending)
	if _, err := order.AddLine("WIDGET", 2, 500, "USD"); err != nil {
		t.Fatalf("add line failed: %v", err)
	}
	repo := after.NewOrderRepository()
	repo.Save(order)

	// Mutating the original after save must not reach the stored copy.
	if _, err := order.AddLine("GADGET", 1, 250, "USD"); err != nil {
		t.Fatalf("add line failed: %v", err)
	}

	loaded, ok := repo.Get(1)
	if !ok {
		t.Fatalf("expected order to be found")
	}
	if got := loaded.TotalMinor(); got != 1000 {
		t.Fatalf("got total %d, want 1000 (unaffected by post-save mutation)", got)
	}
	if got := len(loaded.Lines()); got != 1 {
		t.Fatalf("got %d lines, want 1", got)
	}

	// Mutating the loaded copy must not reach the stored order either.
	if _, err := loaded.AddLine("MUTATED", 1, 1, "USD"); err != nil {
		t.Fatalf("add line failed: %v", err)
	}
	again, _ := repo.Get(1)
	if got := again.TotalMinor(); got != 1000 {
		t.Fatalf("got total %d, want 1000 (unaffected by mutating the loaded copy)", got)
	}
}
