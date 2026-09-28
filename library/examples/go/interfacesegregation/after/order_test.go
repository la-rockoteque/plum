package after

import "testing"

// fakeCancelOrderStore implements the narrow role interface CancelOrder actually
// depends on: exactly two methods, both real.
type fakeCancelOrderStore struct {
	orders map[int]*Order
}

var realMethods = []string{"Get", "Save"}

func (f *fakeCancelOrderStore) Get(orderID int) (*Order, error) { return f.orders[orderID], nil }

func (f *fakeCancelOrderStore) Save(order *Order) error {
	f.orders[order.ID] = order
	return nil
}

func TestAfter_CancelOrdersFakeHasExactlyTwoMethodsBothReal(t *testing.T) {
	store := &fakeCancelOrderStore{orders: map[int]*Order{1: NewOrder(1, "ada@example.com", 500)}}
	var asStore CancelOrderStore = store
	if err := (CancelOrder{Store: asStore}).Execute(1); err != nil {
		t.Fatal(err)
	}
	if store.orders[1].Status != "cancelled" {
		t.Fatalf("got status %q, want cancelled", store.orders[1].Status)
	}
	if len(realMethods) != 2 {
		t.Fatalf("got %d real methods, want 2", len(realMethods))
	}
}

func TestAfter_AddingARoleInterfaceForArchivingDoesNotTouchCancelOrderOrItsFake(t *testing.T) {
	adapter := NewOrderStoreAdapter()
	if err := adapter.Save(NewOrder(1, "ada@example.com", 500)); err != nil {
		t.Fatal(err)
	}
	var archiver OrderArchiver = adapter
	if err := archiver.Archive(1); err != nil {
		t.Fatal(err)
	}
	archived, err := adapter.Get(1)
	if err != nil {
		t.Fatal(err)
	}
	if archived.Status != "archived" {
		t.Fatalf("got status %q, want archived", archived.Status)
	}
	// CancelOrder and its fake are exactly as declared above -- untouched by the new role.
	store := &fakeCancelOrderStore{orders: map[int]*Order{2: NewOrder(2, "ada@example.com", 700)}}
	var asStore CancelOrderStore = store
	if err := (CancelOrder{Store: asStore}).Execute(2); err != nil {
		t.Fatal(err)
	}
	if store.orders[2].Status != "cancelled" {
		t.Fatalf("got status %q, want cancelled", store.orders[2].Status)
	}
	if len(realMethods) != 2 {
		t.Fatalf("got %d real methods, want 2", len(realMethods))
	}
}
