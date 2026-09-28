package after_test

import (
	"errors"
	"testing"

	"example.com/repository-example/domainevents/after"
)

type fixedClock struct{ ms int64 }

func (c fixedClock) NowMs() int64 { return c.ms }

type fakeInventoryService struct {
	released []int
}

func (f *fakeInventoryService) Release(orderID int) error {
	f.released = append(f.released, orderID)
	return nil
}

type fakeMailer struct {
	sent []int
}

func (f *fakeMailer) SendCancellationEmail(orderID int) error {
	f.sent = append(f.sent, orderID)
	return nil
}

var errMailerUnavailable = errors.New("mailer unavailable")

type failingMailer struct{}

func (failingMailer) SendCancellationEmail(orderID int) error {
	return errMailerUnavailable
}

type fakeLoyaltyLedger struct {
	recorded []int
}

func (f *fakeLoyaltyLedger) RecordCancellation(orderID int) error {
	f.recorded = append(f.recorded, orderID)
	return nil
}

var errStorageUnavailable = errors.New("storage unavailable")

type failingSaveOrderRepository struct {
	inner      *after.InMemoryOrderRepository
	failOnSave bool
}

func newFailingSaveOrderRepository() *failingSaveOrderRepository {
	return &failingSaveOrderRepository{inner: after.NewInMemoryOrderRepository()}
}

func (r *failingSaveOrderRepository) Get(orderID int) (*after.Order, bool) {
	return r.inner.Get(orderID)
}

func (r *failingSaveOrderRepository) Save(order *after.Order) error {
	if r.failOnSave {
		return errStorageUnavailable
	}
	return r.inner.Save(order)
}

func TestAfter_CancelRecordsExactlyOneOrderCancelledEventWithTheRightData(t *testing.T) {
	order := after.NewOrder(1)
	if err := order.Cancel("customer request", fixedClock{ms: 1000}); err != nil {
		t.Fatalf("cancel failed: %v", err)
	}
	events := order.PullEvents()
	if len(events) != 1 {
		t.Fatalf("got %d events, want 1", len(events))
	}
	want := after.OrderCancelled{OrderID: 1, Reason: "customer request", OccurredMs: 1000}
	if events[0] != want {
		t.Fatalf("got %+v, want %+v", events[0], want)
	}
	if order.Status() != "cancelled" {
		t.Fatalf("got status %q, want cancelled", order.Status())
	}
}

func TestAfter_CancellingThroughTheServiceDispatchesToEveryRegisteredHandlerAfterASuccessfulSave(t *testing.T) {
	repo := after.NewInMemoryOrderRepository()
	repo.Save(after.NewOrder(1))
	dispatcher := after.NewEventDispatcher()
	inventory := &fakeInventoryService{}
	mailer := &fakeMailer{}
	loyalty := &fakeLoyaltyLedger{}
	dispatcher.Register(after.OrderCancelledEventType, after.ReleaseInventoryHandler{Inventory: inventory})
	dispatcher.Register(after.OrderCancelledEventType, after.SendCancellationEmailHandler{Mailer: mailer})
	dispatcher.Register(after.OrderCancelledEventType, after.RecordLoyaltyCancellationHandler{Loyalty: loyalty})
	service := &after.CancelOrderService{Repo: repo, Dispatcher: dispatcher, Clock: fixedClock{ms: 1000}}

	if err := service.Cancel(1, "customer request"); err != nil {
		t.Fatalf("cancel failed: %v", err)
	}

	if got := inventory.released; len(got) != 1 || got[0] != 1 {
		t.Fatalf("got released %v, want [1]", got)
	}
	if got := mailer.sent; len(got) != 1 || got[0] != 1 {
		t.Fatalf("got sent %v, want [1]", got)
	}
	if got := loyalty.recorded; len(got) != 1 || got[0] != 1 {
		t.Fatalf("got recorded %v, want [1]", got)
	}
	saved, ok := repo.Get(1)
	if !ok || saved.Status() != "cancelled" {
		t.Fatalf("expected order 1 saved as cancelled")
	}
}

func TestAfter_EventsAreNotDispatchedWhenTheSaveFails(t *testing.T) {
	repo := newFailingSaveOrderRepository()
	repo.inner.Save(after.NewOrder(1))
	dispatcher := after.NewEventDispatcher()
	mailer := &fakeMailer{}
	dispatcher.Register(after.OrderCancelledEventType, after.SendCancellationEmailHandler{Mailer: mailer})
	service := &after.CancelOrderService{Repo: repo, Dispatcher: dispatcher, Clock: fixedClock{ms: 1000}}
	repo.failOnSave = true

	err := service.Cancel(1, "customer request")
	if !errors.Is(err, errStorageUnavailable) {
		t.Fatalf("got %v, want storage unavailable", err)
	}
	if len(mailer.sent) != 0 {
		t.Fatalf("got sent %v, want none", mailer.sent)
	}
}

func TestAfter_TheInventoryHandlerReleasesInventoryForTheCancelledOrder(t *testing.T) {
	inventory := &fakeInventoryService{}
	handler := after.ReleaseInventoryHandler{Inventory: inventory}
	if err := handler.Handle(after.OrderCancelled{OrderID: 1, Reason: "customer request", OccurredMs: 1000}); err != nil {
		t.Fatalf("handle failed: %v", err)
	}
	if got := inventory.released; len(got) != 1 || got[0] != 1 {
		t.Fatalf("got released %v, want [1]", got)
	}
}

func TestAfter_TheMailerHandlerSendsACancellationEmail(t *testing.T) {
	mailer := &fakeMailer{}
	handler := after.SendCancellationEmailHandler{Mailer: mailer}
	if err := handler.Handle(after.OrderCancelled{OrderID: 1, Reason: "customer request", OccurredMs: 1000}); err != nil {
		t.Fatalf("handle failed: %v", err)
	}
	if got := mailer.sent; len(got) != 1 || got[0] != 1 {
		t.Fatalf("got sent %v, want [1]", got)
	}
}

func TestAfter_TheLoyaltyHandlerRecordsTheCancellation(t *testing.T) {
	loyalty := &fakeLoyaltyLedger{}
	handler := after.RecordLoyaltyCancellationHandler{Loyalty: loyalty}
	if err := handler.Handle(after.OrderCancelled{OrderID: 1, Reason: "customer request", OccurredMs: 1000}); err != nil {
		t.Fatalf("handle failed: %v", err)
	}
	if got := loyalty.recorded; len(got) != 1 || got[0] != 1 {
		t.Fatalf("got recorded %v, want [1]", got)
	}
}

func TestAfter_AFailingHandlerDoesNotUndoTheCancellation(t *testing.T) {
	repo := after.NewInMemoryOrderRepository()
	repo.Save(after.NewOrder(1))
	dispatcher := after.NewEventDispatcher()
	inventory := &fakeInventoryService{}
	loyalty := &fakeLoyaltyLedger{}
	dispatcher.Register(after.OrderCancelledEventType, after.ReleaseInventoryHandler{Inventory: inventory})
	dispatcher.Register(after.OrderCancelledEventType, after.SendCancellationEmailHandler{Mailer: failingMailer{}})
	dispatcher.Register(after.OrderCancelledEventType, after.RecordLoyaltyCancellationHandler{Loyalty: loyalty})
	service := &after.CancelOrderService{Repo: repo, Dispatcher: dispatcher, Clock: fixedClock{ms: 1000}}

	err := service.Cancel(1, "customer request")
	if !errors.Is(err, errMailerUnavailable) {
		t.Fatalf("got %v, want mailer unavailable", err)
	}

	saved, ok := repo.Get(1)
	if !ok || saved.Status() != "cancelled" {
		t.Fatalf("expected order to remain saved as cancelled despite the handler failure")
	}
	if got := inventory.released; len(got) != 1 || got[0] != 1 {
		t.Fatalf("got released %v, want [1] (handler before the failing one still ran)", got)
	}
	if len(loyalty.recorded) != 0 {
		t.Fatalf("got recorded %v, want none (handler after the failing one never ran)", loyalty.recorded)
	}
}
