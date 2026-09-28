// Package legacy: nobody who still works here wrote this. It has never had a test.
package legacy

type Order struct {
	OrderID       int64
	AmountMinor   int64
	PurchasedAtMs int64
	Status        string
}

func ComputeRefund(order Order, todayMs int64) int64 {
	if order.Status == "hold" {
		return 0
	} else {
		ageDays := (todayMs - order.PurchasedAtMs) / 86400000
		var refund int64
		if ageDays <= 14 {
			refund = order.AmountMinor
		} else {
			refund = (order.AmountMinor * 90) / 100
		}
		if ageDays > 30 {
			return (refund / 100) * 100
		} else {
			return refund
		}
	}
}
