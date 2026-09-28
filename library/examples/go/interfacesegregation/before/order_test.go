package before

import "testing"

// fakeOrderStoreV1 implements the fat interface CancelOrder depends on. Get/Save are
// the only methods CancelOrder calls; the rest exist only to satisfy the contract.
type fakeOrderStoreV1 struct {
	orders map[int]*Order
}

var unusedStubsV1 = []string{"Delete", "ListByCustomer", "ExportCsv", "AuditTrail", "PurgeOlderThan"}

func (f *fakeOrderStoreV1) Get(orderID int) (*Order, error) { return f.orders[orderID], nil }

func (f *fakeOrderStoreV1) Save(order *Order) error {
	f.orders[order.ID] = order
	return nil
}

func (f *fakeOrderStoreV1) Delete(orderID int) error { panic("not used") }

func (f *fakeOrderStoreV1) ListByCustomer(customerEmail string) ([]*Order, error) {
	panic("not used")
}

func (f *fakeOrderStoreV1) ExportCsv() (string, error) { panic("not used") }

func (f *fakeOrderStoreV1) AuditTrail(orderID int) ([]string, error) { panic("not used") }

func (f *fakeOrderStoreV1) PurgeOlderThan(days int) (int, error) { panic("not used") }

// fakeOrderStoreV2 satisfies the grown OrderStoreV2. CancelOrder's own behaviour is
// unchanged, but its fake must grow with the interface -- one more unused stub.
type fakeOrderStoreV2 struct {
	fakeOrderStoreV1
}

var unusedStubsV2 = append(append([]string{}, unusedStubsV1...), "Archive")

func (f *fakeOrderStoreV2) Archive(orderID int) error { panic("not used") }

func TestBefore_CancelOrderWorksButItsFakeStubsFiveUnusedMethods(t *testing.T) {
	store := &fakeOrderStoreV1{orders: map[int]*Order{1: NewOrder(1, "ada@example.com", 500)}}
	var asStore OrderStoreV1 = store
	if err := (CancelOrder{Store: asStore}).Execute(1); err != nil {
		t.Fatal(err)
	}
	if store.orders[1].Status != "cancelled" {
		t.Fatalf("got status %q, want cancelled", store.orders[1].Status)
	}
	if len(unusedStubsV1) != 5 {
		t.Fatalf("got %d unused stubs, want 5", len(unusedStubsV1))
	}
	defer func() {
		if recover() == nil {
			t.Fatal("expected Delete to panic as not used")
		}
	}()
	_ = store.Delete(1)
}

func TestBefore_GrowingTheFatStoreForcesTheCancelTestFakeToGrowToo(t *testing.T) {
	store := &fakeOrderStoreV2{fakeOrderStoreV1{orders: map[int]*Order{1: NewOrder(1, "ada@example.com", 500)}}}
	var asStore OrderStoreV2 = store
	// Cancel order's own behaviour did not change -- it still only calls Get and Save.
	if err := (CancelOrder{Store: asStore}).Execute(1); err != nil {
		t.Fatal(err)
	}
	if store.orders[1].Status != "cancelled" {
		t.Fatalf("got status %q, want cancelled", store.orders[1].Status)
	}
	// But the fake that satisfies the grown interface needed one more unused stub.
	if len(unusedStubsV2) != len(unusedStubsV1)+1 {
		t.Fatalf("got %d unused stubs, want %d", len(unusedStubsV2), len(unusedStubsV1)+1)
	}
	defer func() {
		if recover() == nil {
			t.Fatal("expected Archive to panic as not used")
		}
	}()
	_ = store.Archive(1)
}
