// Package after: the rule lives once, on the order; both handlers call it.
package after

const CancellationWindowMs = 24 * 60 * 60 * 1000

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
	ID         int
	Status     OrderStatus
	PlacedAtMs int64
}

func (o Order) CanBeCancelled(clock Clock) bool {
	if o.Status != Pending {
		return false
	}
	return clock.NowMs()-o.PlacedAtMs <= CancellationWindowMs
}

type CliCancelHandler struct{}

func (CliCancelHandler) CanCancel(order Order, clock Clock) bool {
	return order.CanBeCancelled(clock)
}

type ApiCancelHandler struct{}

func (ApiCancelHandler) CanCancel(order Order, clock Clock) bool {
	return order.CanBeCancelled(clock)
}
