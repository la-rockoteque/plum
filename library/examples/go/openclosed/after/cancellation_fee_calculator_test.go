package after_test

import (
	"testing"

	"example.com/repository-example/openclosed/after"
)

func TestAfter_FeeForAPendingStandardOrderIsFree(t *testing.T) {
	order := after.Order{Type: after.Standard, Amount: 100.0, Pending: true}
	calculator := after.NewCancellationFeeCalculator(nil)
	if fee := calculator.CalculateFee(order); fee != 0.0 {
		t.Fatalf("got %v, want 0.0", fee)
	}
}

func TestAfter_FeeForAShippedStandardOrderIsTheFullAmount(t *testing.T) {
	order := after.Order{Type: after.Standard, Amount: 100.0, Pending: false}
	calculator := after.NewCancellationFeeCalculator(nil)
	if fee := calculator.CalculateFee(order); fee != 100.0 {
		t.Fatalf("got %v, want 100.0", fee)
	}
}

func TestAfter_FeeAndDescriptionForAnExpressOrder(t *testing.T) {
	order := after.Order{Type: after.Express, Amount: 100.0, Pending: true}
	calculator := after.NewCancellationFeeCalculator(nil)
	if fee := calculator.CalculateFee(order); fee != 15.0 {
		t.Fatalf("got %v, want 15.0", fee)
	}
	if desc := calculator.DescribeRefund(order); desc != "Refund minus a flat express handling fee" {
		t.Fatalf("got %q", desc)
	}
}

func TestAfter_FeeForASubscriptionOrderIsProratedByElapsedMonths(t *testing.T) {
	order := after.Order{Type: after.Subscription, Amount: 120.0, MonthsElapsed: 3, TotalMonths: 12}
	calculator := after.NewCancellationFeeCalculator(nil)
	if fee := calculator.CalculateFee(order); fee != 30.0 {
		t.Fatalf("got %v, want 30.0", fee)
	}
}

func TestAfter_ACustomMadeOrderGetsItsOwnRefundDescription(t *testing.T) {
	order := after.Order{Type: after.CustomMade, Amount: 200.0, Pending: true}
	calculator := after.NewCancellationFeeCalculator(nil)
	if fee := calculator.CalculateFee(order); fee != 100.0 {
		t.Fatalf("got %v, want 100.0", fee)
	}
	if desc := calculator.DescribeRefund(order); desc != "50% refund, materials already committed" {
		t.Fatalf("got %q", desc)
	}
}

// giftFeePolicy is a brand-new order type; no existing policy or calculator
// file is touched to add it.
type giftFeePolicy struct{}

func (giftFeePolicy) Fee(after.Order) float64 { return 0.0 }
func (giftFeePolicy) DescribeRefund(after.Order) string {
	return "Full refund, gift orders are always free to cancel"
}

func TestAfter_AddingAGiftPolicyNeedsNoChangeToExistingPolicies(t *testing.T) {
	policies := after.DefaultPolicies()
	policies["gift"] = giftFeePolicy{}
	calculator := after.NewCancellationFeeCalculator(policies)
	order := after.Order{Type: "gift", Amount: 50.0, Pending: true}
	if fee := calculator.CalculateFee(order); fee != 0.0 {
		t.Fatalf("got %v, want 0.0", fee)
	}
	want := "Full refund, gift orders are always free to cancel"
	if desc := calculator.DescribeRefund(order); desc != want {
		t.Fatalf("got %q, want %q", desc, want)
	}
}
