// Package after: the customer owns the question "what discount do I get?"; the service only
// asks it.
package after

type Customer struct {
	Tier          string
	LifetimeSpend float64
	YearsAsMember int
}

// CancellationDiscount is the one place that knows how tier, spend and membership translate
// into a discount.
func (c Customer) CancellationDiscount() float64 {
	switch {
	case c.Tier == "gold":
		return 0.25
	case c.LifetimeSpend >= 1000:
		return 0.125
	case c.YearsAsMember >= 2:
		return 0.0625
	default:
		return 0
	}
}

type Order struct {
	Amount   float64
	Customer Customer
}

type OrderService struct{}

func (OrderService) CancellationFee(order Order) float64 {
	return order.Amount * (1 - order.Customer.CancellationDiscount())
}

func (OrderService) LoyaltyDiscount(customer Customer) float64 {
	return customer.CancellationDiscount()
}
