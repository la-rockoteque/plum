package before

// RefundDescription: the same switch, copy-pasted here for the customer-facing
// message — kept in sync for express and subscription, never updated when
// custom-made orders were added.
type RefundDescription struct{}

func (RefundDescription) Describe(order Order) string {
	switch order.Type {
	case Standard:
		if order.Pending {
			return "Full refund, order not yet processed"
		}
		return "No refund, order already shipped"
	case Express:
		return "Refund minus a flat express handling fee"
	case Subscription:
		return "Prorated refund for unused months"
	default:
		return "Refund processed"
	}
}
