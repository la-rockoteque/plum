package after

import "fmt"

// CancelExpiredOrders depends only on CancellableOrder, so it works for
// every subtype that implements it — no type assertion, and no way to hand
// it a GiftOrder by mistake: *GiftOrder doesn't satisfy CancellableOrder, so
// it can't even compile into this slice.
type CancelExpiredOrders struct{}

func (CancelExpiredOrders) Execute(orders []CancellableOrder, reason string) []int {
	cancelled := make([]int, 0, len(orders))
	for _, order := range orders {
		if err := order.Cancel(reason); err == nil {
			cancelled = append(cancelled, order.ID())
		}
	}
	return cancelled
}

// CustomerServiceCancelTool: same capability, same absence of type checks.
type CustomerServiceCancelTool struct{}

func (CustomerServiceCancelTool) Cancel(order CancellableOrder, reason string) (string, error) {
	if err := order.Cancel(reason); err != nil {
		return "", err
	}
	return fmt.Sprintf("order %d cancelled: %s", order.ID(), reason), nil
}
