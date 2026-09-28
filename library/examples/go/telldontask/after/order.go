// Package after: callers tell the order to cancel itself; Order owns the rule, the timestamp
// and the refund. Setters disappear, and the invalid transition (cancelling a shipped order) is
// rejected once, inside Order, instead of missed by whichever caller forgot to check.
package after

import "fmt"

type OrderStatus string

const (
	Pending   OrderStatus = "pending"
	Shipped   OrderStatus = "shipped"
	Cancelled OrderStatus = "cancelled"
)

type Clock interface {
	NowMs() int64
}

type Order struct {
	id              int
	status          OrderStatus
	amountPaidCents int64
	shippedAtMs     *int64
	cancelledAtMs   *int64
	refundDueCents  int64
}

func NewOrder(id int, status OrderStatus, amountPaidCents int64, shippedAtMs *int64) *Order {
	return &Order{id: id, status: status, amountPaidCents: amountPaidCents, shippedAtMs: shippedAtMs}
}

func (o *Order) Status() OrderStatus    { return o.status }
func (o *Order) AmountPaidCents() int64 { return o.amountPaidCents }
func (o *Order) ShippedAtMs() *int64    { return o.shippedAtMs }
func (o *Order) CancelledAtMs() *int64  { return o.cancelledAtMs }
func (o *Order) RefundDueCents() int64  { return o.refundDueCents }

func (o *Order) Cancel(clock Clock) error {
	if o.status != Pending {
		return fmt.Errorf("cannot cancel an order with status %s", o.status)
	}
	now := clock.NowMs()
	o.status = Cancelled
	o.cancelledAtMs = &now
	o.refundDueCents = o.amountPaidCents
	return nil
}

type ApiCancelHandler struct{}

func (ApiCancelHandler) Cancel(order *Order, clock Clock) error {
	return order.Cancel(clock)
}

type NightlyCancelJob struct{}

func (NightlyCancelJob) Cancel(order *Order, clock Clock) error {
	return order.Cancel(clock)
}

type AdminCancelTool struct{}

func (AdminCancelTool) Cancel(order *Order, clock Clock) error {
	return order.Cancel(clock)
}
