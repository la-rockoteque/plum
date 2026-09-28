package service

import (
	"fmt"
	"reflect"
	"testing"
)

type inMemoryOrderRepository struct {
	orders map[string]*Order
}

func newInMemoryOrderRepository(orders ...*Order) *inMemoryOrderRepository {
	byID := make(map[string]*Order, len(orders))
	for _, order := range orders {
		byID[order.ID] = order
	}
	return &inMemoryOrderRepository{orders: byID}
}

func (r *inMemoryOrderRepository) FindByID(orderID string) (*Order, error) {
	order, ok := r.orders[orderID]
	if !ok {
		return nil, fmt.Errorf("unknown order %s", orderID)
	}
	return order, nil
}

func (r *inMemoryOrderRepository) Save(order *Order) error {
	r.orders[order.ID] = order
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
	calledOrderID string
	calledRefund  float64
	called        bool
}

func (m *mockFormatter) format(orderID string, refundAmount float64) string {
	m.calledOrderID, m.calledRefund, m.called = orderID, refundAmount, true
	return "mocked notification"
}

func anOrder() *Order {
	return NewOrder("order-1", 50.0)
}

// --- before: internal-poking tests --------------------------------------------------------------

func TestBefore_PokingThePrivateFeeHelperAndFieldPassesAgainstThePreRefactorImplementation(t *testing.T) {
	order := anOrder()
	service := NewPreRefactorService(newInMemoryOrderRepository(order), &spyNotifier{})
	// Reach past Cancel() and call the private helper directly.
	if fee := service.calculateFee(order); fee != 5.0 {
		t.Fatalf("got fee %v, want 5.0", fee)
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
	if _, err := service.Cancel("order-1"); err != nil {
		t.Fatal(err)
	}
	if !mock.called || mock.calledOrderID != "order-1" || mock.calledRefund != 45.0 {
		t.Fatalf("expected the mock formatter to be called with order-1, 45.0; got %+v", mock)
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
