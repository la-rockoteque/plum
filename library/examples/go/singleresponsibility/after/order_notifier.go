package after

// OrderNotifier owns the wording of the cancellation email — its only reason
// to change.
type OrderNotifier struct {
	Sent []string
}

func (n *OrderNotifier) NotifyCancelled(order *Order, reason string) {
	n.Sent = append(n.Sent, "Dear "+order.CustomerName+", your order "+order.ID+
		" was cancelled. Reason: "+reason+".")
}
