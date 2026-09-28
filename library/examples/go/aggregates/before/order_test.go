package before_test

import (
	"testing"

	"example.com/repository-example/aggregates/before"
)

func TestBefore_AddingALineDoesNotUpdateTheCachedTotal(t *testing.T) {
	order := before.NewOrder(1)
	repo := before.NewOrderLineRepository()
	repo.Add(&before.OrderLine{ID: 1, OrderID: 1, SKU: "WIDGET", Quantity: 2, UnitPriceMinor: 500, Currency: "USD"})
	if order.TotalMinor != 0 {
		t.Fatalf("got total %d, want 0 (stale)", order.TotalMinor)
	}
}

func TestBefore_AnEleventhLineIsAccepted(t *testing.T) {
	repo := before.NewOrderLineRepository()
	for i := 0; i < 11; i++ {
		repo.Add(&before.OrderLine{ID: i, OrderID: 1, SKU: "SKU", Quantity: 1, UnitPriceMinor: 100, Currency: "USD"})
	}
	if got := len(repo.ForOrder(1)); got != 11 {
		t.Fatalf("got %d lines, want 11", got)
	}
}

func TestBefore_ALinesQuantityCanBeSetToZero(t *testing.T) {
	repo := before.NewOrderLineRepository()
	repo.Add(&before.OrderLine{ID: 1, OrderID: 1, SKU: "WIDGET", Quantity: 2, UnitPriceMinor: 500, Currency: "USD"})
	repo.UpdateQuantity(1, 0)
	if got := repo.ForOrder(1)[0].Quantity; got != 0 {
		t.Fatalf("got quantity %d, want 0", got)
	}
}

func TestBefore_ACancelledOrdersLineCanStillBeChanged(t *testing.T) {
	order := before.NewOrder(1)
	order.Status = "cancelled"
	repo := before.NewOrderLineRepository()
	repo.Add(&before.OrderLine{ID: 1, OrderID: 1, SKU: "WIDGET", Quantity: 2, UnitPriceMinor: 500, Currency: "USD"})
	repo.UpdateQuantity(1, 5)
	if order.Status != "cancelled" {
		t.Fatalf("expected order to remain cancelled")
	}
	if got := repo.ForOrder(1)[0].Quantity; got != 5 {
		t.Fatalf("got quantity %d, want 5", got)
	}
}

func TestBefore_ALineFetchedFromTheRepositoryCanBeMutatedDirectly(t *testing.T) {
	repo := before.NewOrderLineRepository()
	repo.Add(&before.OrderLine{ID: 1, OrderID: 1, SKU: "WIDGET", Quantity: 2, UnitPriceMinor: 500, Currency: "USD"})
	fetched := repo.ForOrder(1)[0]
	fetched.Quantity = 99
	if got := repo.ForOrder(1)[0].Quantity; got != 99 {
		t.Fatalf("got quantity %d, want 99", got)
	}
}

func TestBefore_RecomputeTotalMustBeCalledManuallyToStayCorrect(t *testing.T) {
	order := before.NewOrder(1)
	repo := before.NewOrderLineRepository()
	repo.Add(&before.OrderLine{ID: 1, OrderID: 1, SKU: "WIDGET", Quantity: 2, UnitPriceMinor: 500, Currency: "USD"})
	before.RecomputeTotal(order, repo.ForOrder(1))
	if order.TotalMinor != 1000 {
		t.Fatalf("got total %d, want 1000", order.TotalMinor)
	}
	repo.UpdateQuantity(1, 5)
	if order.TotalMinor != 1000 {
		t.Fatalf("expected stale total 1000, got %d", order.TotalMinor)
	}
}
