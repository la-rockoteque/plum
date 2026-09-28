// Package after: Customer answers its own question - what loyalty discount do I get?
// OrderService only asks, through an interface, so it never cares which representation of
// Customer answers.
package after

// LoyaltyTier is the value type Customer's tier migrated to.
type LoyaltyTier string

const (
	Gold   LoyaltyTier = "gold"
	Silver LoyaltyTier = "silver"
	Bronze LoyaltyTier = "bronze"
)

// DiscountEligible is satisfied by any Customer representation that can answer its own
// loyalty discount.
type DiscountEligible interface {
	LoyaltyDiscount() int
}

type Customer struct {
	Tier               string
	LifetimeSpendMinor int
	YearsAsMember      int
}

// LoyaltyDiscount is the one place that knows how tier, spend and membership translate into
// a discount.
func (c Customer) LoyaltyDiscount() int {
	switch {
	case c.Tier == "gold":
		return 2000
	case c.LifetimeSpendMinor >= 100_000:
		return 1000
	case c.YearsAsMember >= 2:
		return 500
	default:
		return 0
	}
}

// MigratedCustomer asks the same question with a different internal shape - Tier is the
// value type, not a string.
type MigratedCustomer struct {
	Tier               LoyaltyTier
	LifetimeSpendMinor int
	YearsAsMember      int
}

func (c MigratedCustomer) LoyaltyDiscount() int {
	switch {
	case c.Tier == Gold:
		return 2000
	case c.LifetimeSpendMinor >= 100_000:
		return 1000
	case c.YearsAsMember >= 2:
		return 500
	default:
		return 0
	}
}

type Order struct {
	AmountMinor int
	Customer    DiscountEligible
}

type OrderService struct{}

func (OrderService) CancellationFee(order Order) int {
	discountBps := order.Customer.LoyaltyDiscount()
	return order.AmountMinor * (10_000 - discountBps) / 10_000
}

func (OrderService) LoyaltyDiscount(customer DiscountEligible) int {
	return customer.LoyaltyDiscount()
}
