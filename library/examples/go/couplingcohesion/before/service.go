// Package before is a teaching artifact: the service reaches into the customer's fields to
// compute a discount, and the rule gets duplicated (and drifts) because nothing owns it but
// the service.
package before

// Customer's fields are exported because the service reaches straight into them.
type Customer struct {
	Tier          string
	LifetimeSpend float64
	YearsAsMember int
}

type Order struct {
	Amount   float64
	Customer Customer
}

type OrderService struct{}

func (OrderService) CancellationFee(order Order) float64 {
	// Feature envy: three of the customer's fields, read here instead of asked for.
	customer := order.Customer
	var discount float64
	switch {
	case customer.Tier == "gold":
		discount = 0.25
	case customer.LifetimeSpend >= 1000:
		discount = 0.125
	case customer.YearsAsMember >= 2:
		discount = 0.0625
	default:
		discount = 0
	}
	return order.Amount * (1 - discount)
}

func (OrderService) LoyaltyDiscount(customer Customer) float64 {
	// The same rule, copied for a receipt line — and it has drifted (`>` vs `>=`).
	switch {
	case customer.Tier == "gold":
		return 0.25
	case customer.LifetimeSpend > 1000:
		return 0.125
	case customer.YearsAsMember >= 2:
		return 0.0625
	default:
		return 0
	}
}
