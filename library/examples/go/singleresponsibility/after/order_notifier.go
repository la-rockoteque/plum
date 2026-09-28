package after

import "strconv"

// OrderNotifier owns the wording of the cancellation email — its only reason
// to change. Satisfies CancelOrder's Notifier port structurally; nothing
// declares it.
type OrderNotifier struct {
	Sent []string
}

func (n *OrderNotifier) NotifyCancelled(order *Order, reason string) {
	n.Sent = append(n.Sent, "Dear "+order.CustomerName+", your order "+strconv.Itoa(order.ID)+
		" was cancelled. Reason: "+reason+".")
}
