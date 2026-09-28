package before

import "testing"

func TestBefore_CancellationFeeAndLoyaltyDiscountReadTheCustomersFieldsDirectly(t *testing.T) {
	gold := Customer{Tier: "gold", LifetimeSpendMinor: 50_000, YearsAsMember: 1}
	order := Order{AmountMinor: 10_000, Customer: gold}
	service := OrderService{}
	if fee := service.CancellationFee(order); fee != 8_000 {
		t.Fatalf("got fee %v, want 8000", fee)
	}
	if discount := service.LoyaltyDiscount(gold); discount != 2000 {
		t.Fatalf("got discount %v, want 2000", discount)
	}

	bigSpender := Customer{Tier: "bronze", LifetimeSpendMinor: 150_000, YearsAsMember: 0}
	if discount := service.LoyaltyDiscount(bigSpender); discount != 1000 {
		t.Fatalf("got discount %v, want 1000", discount)
	}
}

func TestBefore_AMigratedCustomerRepresentationNeedsItsOwnOrderServiceMethod(t *testing.T) {
	migrated := MigratedCustomer{Tier: Gold, LifetimeSpendMinor: 50_000, YearsAsMember: 1}
	service := OrderService{}
	// Customer's tier became a value type; OrderService had to gain a whole new method to
	// read it - the change cost of reaching into Customer's representation instead of asking.
	if discount := service.MigratedLoyaltyDiscount(migrated); discount != 2000 {
		t.Fatalf("got discount %v, want 2000", discount)
	}
}
