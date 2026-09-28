package after_test

import (
	"errors"
	"testing"

	"example.com/repository-example/aggregates/after"
)

func TestAfter_AddingALineUpdatesTheTotalImmediately(t *testing.T) {
	order := after.NewOrder(1)
	if _, err := order.AddLine("WIDGET", 2, 500); err != nil {
		t.Fatalf("add line failed: %v", err)
	}
	if got := order.TotalMinor(); got != 1000 {
		t.Fatalf("got total %d, want 1000", got)
	}
}

func TestAfter_AnEleventhLineIsRejected(t *testing.T) {
	order := after.NewOrder(1)
	for i := 0; i < 10; i++ {
		if _, err := order.AddLine("SKU", 1, 100); err != nil {
			t.Fatalf("add line failed: %v", err)
		}
	}
	if _, err := order.AddLine("SKU", 1, 100); !errors.Is(err, after.ErrTooManyLines) {
		t.Fatalf("got %v, want too many lines", err)
	}
}

func TestAfter_ChangingALinesQuantityToZeroIsRejected(t *testing.T) {
	order := after.NewOrder(1)
	lineID, err := order.AddLine("WIDGET", 2, 500)
	if err != nil {
		t.Fatalf("add line failed: %v", err)
	}
	if err := order.ChangeQuantity(lineID, 0); !errors.Is(err, after.ErrInvalidQuantity) {
		t.Fatalf("got %v, want invalid quantity", err)
	}
}

func TestAfter_ChangingALineOnACancelledOrderIsRejected(t *testing.T) {
	order := after.NewOrder(1)
	lineID, err := order.AddLine("WIDGET", 2, 500)
	if err != nil {
		t.Fatalf("add line failed: %v", err)
	}
	order.Cancel()
	if err := order.ChangeQuantity(lineID, 3); !errors.Is(err, after.ErrOrderCancelled) {
		t.Fatalf("got %v, want order cancelled", err)
	}
}

func TestAfter_TheLinesReturnedByTheOrderAreCopiesThatCannotMutateIt(t *testing.T) {
	order := after.NewOrder(1)
	if _, err := order.AddLine("WIDGET", 2, 500); err != nil {
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
	order := after.NewOrder(1)
	if _, err := order.AddLine("WIDGET", 2, 500); err != nil {
		t.Fatalf("add line failed: %v", err)
	}
	repo := after.NewOrderRepository()
	repo.Save(order)

	loaded, ok := repo.Get(1)
	if !ok {
		t.Fatalf("expected order to be found")
	}
	if got := loaded.TotalMinor(); got != 1000 {
		t.Fatalf("got total %d, want 1000", got)
	}
	if got := len(loaded.Lines()); got != 1 {
		t.Fatalf("got %d lines, want 1", got)
	}
}
