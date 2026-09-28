// Package before: the cancellation-eligibility rule is copy-pasted into a CLI and an API handler.
package before

const CancellationWindowMs = 24 * 60 * 60 * 1000

type OrderStatus string

const (
	Pending   OrderStatus = "pending"
	Shipped   OrderStatus = "shipped"
	Cancelled OrderStatus = "cancelled"
)

type Order struct {
	ID         int
	Status     OrderStatus
	PlacedAtMs int64
}

type Clock interface {
	NowMs() int64
}

// CliCancelHandler got the window check in a later bug fix.
type CliCancelHandler struct{}

func (CliCancelHandler) CanCancel(order Order, clock Clock) bool {
	if order.Status != Pending {
		return false
	}
	return clock.NowMs()-order.PlacedAtMs <= CancellationWindowMs
}

// ApiCancelHandler was copy-pasted from the CLI handler before the window check was added.
type ApiCancelHandler struct{}

func (ApiCancelHandler) CanCancel(order Order, clock Clock) bool {
	return order.Status == Pending
}
