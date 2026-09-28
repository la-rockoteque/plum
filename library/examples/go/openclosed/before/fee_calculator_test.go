package before_test

import (
	"testing"

	"example.com/repository-example/openclosed/before"
)

func TestBefore_FeeForAPendingStandardOrderIsFree(t *testing.T) {
	order := before.Order{Type: before.Standard, Amount: 100.0, Pending: true}
	fee, err := (before.CancellationFeeCalculator{}).CalculateFee(order)
	if err != nil || fee != 0.0 {
		t.Fatalf("got fee=%v err=%v, want 0.0", fee, err)
	}
}

func TestBefore_FeeForAShippedStandardOrderIsTheFullAmount(t *testing.T) {
	order := before.Order{Type: before.Standard, Amount: 100.0, Pending: false}
	fee, err := (before.CancellationFeeCalculator{}).CalculateFee(order)
	if err != nil || fee != 100.0 {
		t.Fatalf("got fee=%v err=%v, want 100.0", fee, err)
	}
}

func TestBefore_FeeAndDescriptionForAnExpressOrder(t *testing.T) {
	order := before.Order{Type: before.Express, Amount: 100.0, Pending: true}
	fee, err := (before.CancellationFeeCalculator{}).CalculateFee(order)
	if err != nil || fee != 15.0 {
		t.Fatalf("got fee=%v err=%v, want 15.0", fee, err)
	}
	desc := (before.RefundDescription{}).Describe(order)
	if desc != "Refund minus a flat express handling fee" {
		t.Fatalf("got %q", desc)
	}
}

func TestBefore_FeeForASubscriptionOrderIsProratedByElapsedMonths(t *testing.T) {
	order := before.Order{Type: before.Subscription, Amount: 120.0, MonthsElapsed: 3, TotalMonths: 12}
	fee, err := (before.CancellationFeeCalculator{}).CalculateFee(order)
	if err != nil || fee != 30.0 {
		t.Fatalf("got fee=%v err=%v, want 30.0", fee, err)
	}
}

func TestBefore_ACustomMadeOrderGetsTheWrongRefundDescriptionDespiteTheRightFee(t *testing.T) {
	order := before.Order{Type: before.CustomMade, Amount: 200.0, Pending: true}
	fee, err := (before.CancellationFeeCalculator{}).CalculateFee(order)
	if err != nil || fee != 100.0 {
		t.Fatalf("got fee=%v err=%v, want 100.0", fee, err)
	}
	desc := (before.RefundDescription{}).Describe(order)
	if desc != "Refund processed" {
		t.Fatalf("got %q, want the missing-case fallback", desc)
	}
}
