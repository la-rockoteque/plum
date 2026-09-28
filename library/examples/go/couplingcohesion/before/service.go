// Package before: the service reaches into the customer's fields to compute a discount. When
// Customer's tier becomes a value type instead of a string, OrderService can't reuse its
// existing logic on the new shape - it needs a whole new method just to read it.
package before

// LoyaltyTier is the value type Customer's tier migrates to.
type LoyaltyTier string

const (
	Gold   LoyaltyTier = "gold"
	Silver LoyaltyTier = "silver"
	Bronze LoyaltyTier = "bronze"
)

// Customer's fields are exported because the service reaches straight into them.
type Customer struct {
	Tier               string
	LifetimeSpendMinor int
	YearsAsMember      int
}

// MigratedCustomer holds the same facts as Customer, after a migration - Tier is now the
// value type, not a string.
type MigratedCustomer struct {
	Tier               LoyaltyTier
	LifetimeSpendMinor int
	YearsAsMember      int
}

type Order struct {
	AmountMinor int
	Customer    Customer
}

type OrderService struct{}

func (OrderService) CancellationFee(order Order) int {
	// Feature envy: three of the customer's fields, read here instead of asked for.
	customer := order.Customer
	var discountBps int
	switch {
	case customer.Tier == "gold":
		discountBps = 2000
	case customer.LifetimeSpendMinor >= 100_000:
		discountBps = 1000
	case customer.YearsAsMember >= 2:
		discountBps = 500
	default:
		discountBps = 0
	}
	return order.AmountMinor * (10_000 - discountBps) / 10_000
}

func (OrderService) LoyaltyDiscount(customer Customer) int {
	// The same interpretation, read again for a receipt line.
	switch {
	case customer.Tier == "gold":
		return 2000
	case customer.LifetimeSpendMinor >= 100_000:
		return 1000
	case customer.YearsAsMember >= 2:
		return 500
	default:
		return 0
	}
}

// MigratedLoyaltyDiscount exists only because Customer's tier became a value type -
// OrderService needed a whole new method just to read it.
func (OrderService) MigratedLoyaltyDiscount(customer MigratedCustomer) int {
	switch {
	case customer.Tier == Gold:
		return 2000
	case customer.LifetimeSpendMinor >= 100_000:
		return 1000
	case customer.YearsAsMember >= 2:
		return 500
	default:
		return 0
	}
}
