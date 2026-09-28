package service

import (
	"fmt"
	"reflect"
	"testing"
)

func cloneOrder(order *Order) *Order {
	clone := *order
	return &clone
}

// inMemoryOrderRepository is a fake with real find/save behaviour, no external system. It copies
// on write and read, so a caller can't observe state through a reference it never went through
// the repository for.
type inMemoryOrderRepository struct {
	orders map[int]*Order
}

func newInMemoryOrderRepository(orders ...*Order) *inMemoryOrderRepository {
	byID := make(map[int]*Order, len(orders))
	for _, order := range orders {
		byID[order.ID] = cloneOrder(order)
	}
	return &inMemoryOrderRepository{orders: byID}
}

func (r *inMemoryOrderRepository) FindByID(orderID int) (*Order, error) {
	order, ok := r.orders[orderID]
	if !ok {
		return nil, fmt.Errorf("unknown order %d", orderID)
	}
	return cloneOrder(order), nil
}

func (r *inMemoryOrderRepository) Save(order *Order) error {
	r.orders[order.ID] = cloneOrder(order)
	return nil
}

type spyNotifier struct {
	sent []string
}

func (n *spyNotifier) Send(message string) error {
	n.sent = append(n.sent, message)
	return nil
}

// mockFormatter is a hand-rolled double for the service's OWN internal collaborator - not a port.
type mockFormatter struct {
	calledOrderID int
	calledRefund  int
	called        bool
}

func (m *mockFormatter) format(orderID int, refundAmountMinor int) string {
	m.calledOrderID, m.calledRefund, m.called = orderID, refundAmountMinor, true
	return "mocked notification"
}

func anOrder() *Order {
	return NewOrder(1, 5000)
}

// --- before: internal-poking tests --------------------------------------------------------------

func TestBefore_PokingThePrivateFeeHelperAndFieldPassesAgainstThePreRefactorImplementation(t *testing.T) {
	order := anOrder()
	service := NewPreRefactorService(newInMemoryOrderRepository(order), &spyNotifier{})
	// Reach past Cancel() and call the private helper directly.
	if fee := service.calculateFee(order); fee != 500 {
		t.Fatalf("got fee %v, want 500", fee)
	}
	// Assert on a private field instead of an observable outcome.
	if service.feeRate != 0.1 {
		t.Fatalf("got feeRate %v, want 0.1", service.feeRate)
	}
}

func TestBefore_MockingTheServicesOwnFormatterPassesButCouplesTheTestToImplementation(t *testing.T) {
	order := anOrder()
	service := NewPreRefactorService(newInMemoryOrderRepository(order), &spyNotifier{})
	mock := &mockFormatter{}
	service.formatter = mock // reach in and replace a collaborator the service built for itself
	if _, err := service.Cancel(1); err != nil {
		t.Fatal(err)
	}
	if !mock.called || mock.calledOrderID != 1 || mock.calledRefund != 4500 {
		t.Fatalf("expected the mock formatter to be called with 1, 4500; got %+v", mock)
	}
}

func TestBefore_TheSamePrivatePokingAssertionsNoLongerHoldAfterAPureRefactor(t *testing.T) {
	service := NewPostRefactorService(newInMemoryOrderRepository(anOrder()), &spyNotifier{})
	v := reflect.ValueOf(service).Elem()
	// The field the pre-refactor test asserted on directly was renamed.
	if v.FieldByName("feeRate").IsValid() {
		t.Fatal("expected feeRate to no longer exist after the refactor")
	}
	rate := v.FieldByName("cancellationFeeRate")
	if !rate.IsValid() || rate.Float() != 0.1 {
		t.Fatalf("expected cancellationFeeRate to exist and equal 0.1, got %v", rate)
	}
}
