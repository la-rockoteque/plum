package after

import "testing"

func TestAfter_CancellationFeeAsksTheCustomerForItsOwnDiscount(t *testing.T) {
	customer := Customer{Tier: "gold", LifetimeSpend: 500, YearsAsMember: 1}
	order := Order{Amount: 100, Customer: customer}
	service := OrderService{}
	if fee := service.CancellationFee(order); fee != 75.0 {
		t.Fatalf("got fee %v, want 75.0", fee)
	}
	if discount := service.LoyaltyDiscount(customer); discount != 0.25 {
		t.Fatalf("got discount %v, want 0.25", discount)
	}
}

func TestAfter_CancellationFeeAndLoyaltyDiscountAgreeAtTheSpendBoundary(t *testing.T) {
	customer := Customer{Tier: "bronze", LifetimeSpend: 1000, YearsAsMember: 0}
	order := Order{Amount: 200, Customer: customer}
	service := OrderService{}
	if fee := service.CancellationFee(order); fee != 175.0 {
		t.Fatalf("got fee %v, want 175.0", fee)
	}
	if discount := service.LoyaltyDiscount(customer); discount != 0.125 {
		t.Fatalf("got discount %v, want 0.125 (the same rule the fee used)", discount)
	}
}
