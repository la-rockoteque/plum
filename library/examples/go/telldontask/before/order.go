// Package before is a teaching artifact: three callers each ask Order for its state, decide in
// their own if, and set the fields back. The API handler gets it right; the nightly job forgets
// the refund; the admin tool never checks whether the order already shipped.
package before

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
	ID              int
	Status          OrderStatus
	AmountPaidCents int64
	ShippedAtMs     *int64
	CancelledAtMs   *int64
	RefundDueCents  int64
}

// ApiCancelHandler is the customer-facing cancel endpoint. Gets the rule right.
type ApiCancelHandler struct{}

func (ApiCancelHandler) Cancel(order *Order, clock Clock) {
	if order.Status != Pending {
		return
	}
	now := clock.NowMs()
	order.Status = Cancelled
	order.CancelledAtMs = &now
	order.RefundDueCents = order.AmountPaidCents
}

// NightlyCancelJob auto-cancels stale pending orders. Forgot to carry the refund forward.
type NightlyCancelJob struct{}

func (NightlyCancelJob) Cancel(order *Order, clock Clock) {
	if order.Status != Pending {
		return
	}
	now := clock.NowMs()
	order.Status = Cancelled
	order.CancelledAtMs = &now
	// Bug: RefundDueCents is never set, even though the customer paid.
}

// AdminCancelTool lets support force-cancel an order by id. Never checks the current status first.
type AdminCancelTool struct{}

func (AdminCancelTool) Cancel(order *Order, clock Clock) {
	// Bug: no status check, so a shipped order can be "cancelled" too.
	now := clock.NowMs()
	order.Status = Cancelled
	order.CancelledAtMs = &now
	order.RefundDueCents = order.AmountPaidCents
}
