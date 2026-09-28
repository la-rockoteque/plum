package service_test

import (
	"fmt"
	"testing"

	"example.com/repository-example/testingthroughpublicapi/service"
)

func cloneOrder(order *service.Order) *service.Order {
	clone := *order
	return &clone
}

// inMemoryOrderRepository is a fake with real find/save behaviour, no external system. It copies
// on write and read, so a caller can't observe state through a reference it never went through
// the repository for.
type inMemoryOrderRepository struct {
	orders map[int]*service.Order
}

func newInMemoryOrderRepository(orders ...*service.Order) *inMemoryOrderRepository {
	byID := make(map[int]*service.Order, len(orders))
	for _, order := range orders {
		byID[order.ID] = cloneOrder(order)
	}
	return &inMemoryOrderRepository{orders: byID}
}

func (r *inMemoryOrderRepository) FindByID(orderID int) (*service.Order, error) {
	order, ok := r.orders[orderID]
	if !ok {
		return nil, fmt.Errorf("unknown order %d", orderID)
	}
	return cloneOrder(order), nil
}

func (r *inMemoryOrderRepository) Save(order *service.Order) error {
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

func anOrder() *service.Order {
	return service.NewOrder(1, 5000)
}

// cancelOrderOnce is the SAME public-API test case, run unmodified against both implementations.
func cancelOrderOnce(t *testing.T, cancel func(orderID int) (service.CancellationOutcome, error), orders *inMemoryOrderRepository, notifier *spyNotifier) {
	t.Helper()
	outcome, err := cancel(1)
	if err != nil {
		t.Fatal(err)
	}
	if outcome.OrderID != 1 || outcome.RefundAmountMinor != 4500 || outcome.Status != service.Cancelled {
		t.Fatalf("unexpected outcome: %+v", outcome)
	}
	// Observable via the fake repository: state was actually persisted.
	saved, err := orders.FindByID(1)
	if err != nil {
		t.Fatal(err)
	}
	if saved.Status != service.Cancelled {
		t.Fatalf("got status %q, want cancelled", saved.Status)
	}
	// Observable via the notifier spy: the right message was sent.
	want := []string{"Order 1 cancelled; refund 4500"}
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
