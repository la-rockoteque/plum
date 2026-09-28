// Package refactored: same behaviour as legacy.ComputeRefund, including its odd cases - named and
// pinned by the characterization tests rather than "fixed" in passing.
package refactored

const (
	msPerDay                     = 24 * 60 * 60 * 1000
	fullRefundWindowDays         = 14
	lateRefundPercent            = 90
	staleOrderThresholdDays      = 30
	staleRefundRoundingUnitMinor = 100
)

type Order struct {
	OrderID       int64
	AmountMinor   int64
	PurchasedAtMs int64
	Status        string
}

func ageInDays(order Order, todayMs int64) int64 {
	return (todayMs - order.PurchasedAtMs) / msPerDay
}

func baseRefundMinor(order Order, ageDays int64) int64 {
	if ageDays <= fullRefundWindowDays {
		return order.AmountMinor
	}
	return (order.AmountMinor * lateRefundPercent) / 100
}

func roundDownIfStale(refundMinor int64, ageDays int64) int64 {
	if ageDays > staleOrderThresholdDays {
		return (refundMinor / staleRefundRoundingUnitMinor) * staleRefundRoundingUnitMinor
	}
	return refundMinor
}

func ComputeRefund(order Order, todayMs int64) int64 {
	if order.Status == "hold" {
		return 0
	}
	ageDays := ageInDays(order, todayMs)
	refund := baseRefundMinor(order, ageDays)
	return roundDownIfStale(refund, ageDays)
}
