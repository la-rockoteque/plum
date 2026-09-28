package after

// FeePolicy: one policy per order type: each owns both its fee and its
// refund description, so the two concerns can never fall out of sync again.
type FeePolicy interface {
	Fee(order Order) float64
	DescribeRefund(order Order) string
}

const (
	ExpressFlatFee    = 15.0
	CustomMadeFeeRate = 0.5
)

type StandardFeePolicy struct{}

func (StandardFeePolicy) Fee(order Order) float64 {
	if order.Pending {
		return 0.0
	}
	return order.Amount
}

func (StandardFeePolicy) DescribeRefund(order Order) string {
	if order.Pending {
		return "Full refund, order not yet processed"
	}
	return "No refund, order already shipped"
}

type ExpressFeePolicy struct{}

func (ExpressFeePolicy) Fee(Order) float64 { return ExpressFlatFee }
func (ExpressFeePolicy) DescribeRefund(Order) string {
	return "Refund minus a flat express handling fee"
}

type CustomMadeFeePolicy struct{}

func (CustomMadeFeePolicy) Fee(order Order) float64 { return order.Amount * CustomMadeFeeRate }
func (CustomMadeFeePolicy) DescribeRefund(Order) string {
	return "50% refund, materials already committed"
}

type SubscriptionFeePolicy struct{}

func (SubscriptionFeePolicy) Fee(order Order) float64 {
	return order.Amount * float64(order.MonthsElapsed) / float64(order.TotalMonths)
}
func (SubscriptionFeePolicy) DescribeRefund(Order) string { return "Prorated refund for unused months" }

func DefaultPolicies() map[string]FeePolicy {
	return map[string]FeePolicy{
		Standard:     StandardFeePolicy{},
		Express:      ExpressFeePolicy{},
		CustomMade:   CustomMadeFeePolicy{},
		Subscription: SubscriptionFeePolicy{},
	}
}
