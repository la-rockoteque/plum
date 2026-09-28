// Package after: Cancel only changes state and records an event; handlers react later.
package after

import "errors"

var ErrOrderAlreadyCancelled = errors.New("order is already cancelled")
var ErrOrderNotFound = errors.New("no such order")

type Clock interface {
	NowMs() int64
}

type InventoryService interface {
	Release(orderID int) error
}

type Mailer interface {
	SendCancellationEmail(orderID int) error
}

type LoyaltyLedger interface {
	RecordCancellation(orderID int) error
}

// OrderCancelledEventType is the key handlers register against — a plain string, no reflection.
const OrderCancelledEventType = "OrderCancelled"

// OrderCancelled is an immutable fact: this happened. Not a request for anything to happen.
type OrderCancelled struct {
	OrderID    int
	Reason     string
	OccurredMs int64
}

func (OrderCancelled) EventType() string { return OrderCancelledEventType }

// Order is the aggregate root: Cancel changes state and records what happened, nothing else.
type Order struct {
	ID     int
	status string
	events []OrderCancelled
}

func NewOrder(id int) *Order {
	return &Order{ID: id, status: "pending"}
}

func (o *Order) Status() string { return o.status }

// Copy returns a detached copy of the stored state; pending events stay with the original.
func (o *Order) Copy() *Order { return &Order{ID: o.ID, status: o.status} }

func (o *Order) Cancel(reason string, clock Clock) error {
	if o.status == "cancelled" {
		return ErrOrderAlreadyCancelled
	}
	o.status = "cancelled"
	o.events = append(o.events, OrderCancelled{OrderID: o.ID, Reason: reason, OccurredMs: clock.NowMs()})
	return nil
}

// PullEvents returns the recorded events and clears them, so a dispatch is never repeated.
func (o *Order) PullEvents() []OrderCancelled {
	events := o.events
	o.events = nil
	return events
}

type OrderRepository interface {
	Get(orderID int) (*Order, bool)
	Save(order *Order) error
}

type InMemoryOrderRepository struct {
	orders map[int]*Order
}

func NewInMemoryOrderRepository() *InMemoryOrderRepository {
	return &InMemoryOrderRepository{orders: make(map[int]*Order)}
}

func (r *InMemoryOrderRepository) Get(orderID int) (*Order, bool) {
	order, ok := r.orders[orderID]
	if !ok {
		return nil, false
	}
	return order.Copy(), true
}

func (r *InMemoryOrderRepository) Save(order *Order) error {
	r.orders[order.ID] = order.Copy()
	return nil
}

type EventHandler interface {
	Handle(event OrderCancelled) error
}

// EventDispatcher keeps a plain list of handlers per event type. No framework.
type EventDispatcher struct {
	handlers map[string][]EventHandler
}

func NewEventDispatcher() *EventDispatcher {
	return &EventDispatcher{handlers: make(map[string][]EventHandler)}
}

func (d *EventDispatcher) Register(eventType string, handler EventHandler) {
	d.handlers[eventType] = append(d.handlers[eventType], handler)
}

func (d *EventDispatcher) Dispatch(events []OrderCancelled) error {
	for _, event := range events {
		for _, handler := range d.handlers[event.EventType()] {
			if err := handler.Handle(event); err != nil {
				return err
			}
		}
	}
	return nil
}

type ReleaseInventoryHandler struct{ Inventory InventoryService }

func (h ReleaseInventoryHandler) Handle(event OrderCancelled) error {
	return h.Inventory.Release(event.OrderID)
}

type SendCancellationEmailHandler struct{ Mailer Mailer }

func (h SendCancellationEmailHandler) Handle(event OrderCancelled) error {
	return h.Mailer.SendCancellationEmail(event.OrderID)
}

type RecordLoyaltyCancellationHandler struct{ Loyalty LoyaltyLedger }

func (h RecordLoyaltyCancellationHandler) Handle(event OrderCancelled) error {
	return h.Loyalty.RecordCancellation(event.OrderID)
}

// CancelOrderService is the application service: save the aggregate, then dispatch what it recorded.
type CancelOrderService struct {
	Repo       OrderRepository
	Dispatcher *EventDispatcher
	Clock      Clock
}

func (s *CancelOrderService) Cancel(orderID int, reason string) error {
	order, ok := s.Repo.Get(orderID)
	if !ok {
		return ErrOrderNotFound
	}
	if err := order.Cancel(reason, s.Clock); err != nil {
		return err
	}
	if err := s.Repo.Save(order); err != nil {
		return err
	}
	return s.Dispatcher.Dispatch(order.PullEvents())
}
