package after

// CancellationFeeCalculator chooses the policy once, by order type; a new
// type means adding to the map passed in here, never a new branch in this type.
type CancellationFeeCalculator struct {
	Policies map[string]FeePolicy
}

func NewCancellationFeeCalculator(policies map[string]FeePolicy) *CancellationFeeCalculator {
	if policies == nil {
		policies = DefaultPolicies()
	}
	return &CancellationFeeCalculator{Policies: policies}
}

func (c *CancellationFeeCalculator) CalculateFee(order Order) float64 {
	return c.Policies[order.Type].Fee(order)
}

func (c *CancellationFeeCalculator) DescribeRefund(order Order) string {
	return c.Policies[order.Type].DescribeRefund(order)
}
