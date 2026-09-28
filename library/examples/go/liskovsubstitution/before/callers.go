package before

import "fmt"

// CancelExpiredOrders is written against the Order contract. Because
// GiftOrder strengthens that contract's precondition, this caller has to
// know about GiftOrder by name to avoid the broken cancellation.
type CancelExpiredOrders struct{}

func (CancelExpiredOrders) Execute(orders []Order, reason string) (cancelled []int, skipped []int) {
	for _, order := range orders {
		if _, ok := order.(*GiftOrder); ok {
			skipped = append(skipped, order.ID())
			continue
		}
		if err := order.Cancel(reason); err == nil {
			cancelled = append(cancelled, order.ID())
		}
	}
	return cancelled, skipped
}

// CustomerServiceCancelTool is a second caller against the same Order
// contract, forced to grow the same type check as CancelExpiredOrders — the
// change cost of the violation is paid twice.
type CustomerServiceCancelTool struct{}

func (CustomerServiceCancelTool) Cancel(order Order, reason string) (string, error) {
	if _, ok := order.(*GiftOrder); ok {
		return "", fmt.Errorf("order %d must be cancelled by phone: %w", order.ID(), ErrGiftOrdersCannotBeCancelledOnline)
	}
	if err := order.Cancel(reason); err != nil {
		return "", err
	}
	return fmt.Sprintf("order %d cancelled: %s", order.ID(), reason), nil
}
