// Package after: delete down to what's actually called — one method with the rule.
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
