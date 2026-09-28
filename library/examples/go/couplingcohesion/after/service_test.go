package after

import "testing"

func TestAfter_CancellationFeeAsksTheCustomerForItsOwnDiscount(t *testing.T) {
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

func TestAfter_OrderServiceNeedsNoChangesForAMigratedCustomerRepresentation(t *testing.T) {
	migrated := MigratedCustomer{Tier: Gold, LifetimeSpendMinor: 50_000, YearsAsMember: 1}
	order := Order{AmountMinor: 10_000, Customer: migrated}
	service := OrderService{}
	// Same OrderService code, unedited, gives the same answer for the new representation.
	if fee := service.CancellationFee(order); fee != 8_000 {
		t.Fatalf("got fee %v, want 8000", fee)
	}
	if discount := service.LoyaltyDiscount(migrated); discount != 2000 {
		t.Fatalf("got discount %v, want 2000", discount)
	}
}
