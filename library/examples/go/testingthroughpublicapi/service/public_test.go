package service_test

import (
	"fmt"
	"testing"

	"example.com/repository-example/testingthroughpublicapi/service"
)

type inMemoryOrderRepository struct {
	orders map[string]*service.Order
}

func newInMemoryOrderRepository(orders ...*service.Order) *inMemoryOrderRepository {
	byID := make(map[string]*service.Order, len(orders))
	for _, order := range orders {
		byID[order.ID] = order
	}
	return &inMemoryOrderRepository{orders: byID}
}

func (r *inMemoryOrderRepository) FindByID(orderID string) (*service.Order, error) {
	order, ok := r.orders[orderID]
	if !ok {
		return nil, fmt.Errorf("unknown order %s", orderID)
	}
	return order, nil
}

func (r *inMemoryOrderRepository) Save(order *service.Order) error {
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

func anOrder() *service.Order {
	return service.NewOrder("order-1", 50.0)
}

// cancelOrderOnce is the SAME public-API test case, run unmodified against both implementations.
func cancelOrderOnce(t *testing.T, cancel func(orderID string) (service.CancellationOutcome, error), orders *inMemoryOrderRepository, notifier *spyNotifier) {
	t.Helper()
	outcome, err := cancel("order-1")
	if err != nil {
		t.Fatal(err)
	}
	if outcome.OrderID != "order-1" || outcome.RefundAmount != 45.0 || outcome.Status != "cancelled" {
		t.Fatalf("unexpected outcome: %+v", outcome)
	}
	// Observable via the fake repository: state was actually persisted.
	saved, err := orders.FindByID("order-1")
	if err != nil {
		t.Fatal(err)
	}
	if saved.Status != "cancelled" {
		t.Fatalf("got status %q, want cancelled", saved.Status)
	}
	// Observable via the notifier spy: the right message was sent.
	want := []string{"Order order-1 cancelled; refund 45.00"}
	if len(notifier.sent) != 1 || notifier.sent[0] != want[0] {
		t.Fatalf("got %v, want %v", notifier.sent, want)
	}
}

func TestAfter_CancellingThroughThePublicApiBehavesIdenticallyAgainstThePreRefactorImplementation(t *testing.T) {
	orders := newInMemoryOrderRepository(anOrder())
	notifier := &spyNotifier{}
	svc := service.NewPreRefactorService(orders, notifier)
	cancelOrderOnce(t, svc.Cancel, orders, notifier)
}

func TestAfter_CancellingThroughThePublicApiBehavesIdenticallyAgainstThePostRefactorImplementation(t *testing.T) {
	orders := newInMemoryOrderRepository(anOrder())
	notifier := &spyNotifier{}
	svc := service.NewPostRefactorService(orders, notifier)
	cancelOrderOnce(t, svc.Cancel, orders, notifier)
}
