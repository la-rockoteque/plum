// Package before: cancellation fees and refund descriptions vary by order type.
package before

const (
	Standard     = "standard"
	Express      = "express"
	CustomMade   = "custom-made"
	Subscription = "subscription"
)

const (
	ExpressFlatFee    = 15.0
	CustomMadeFeeRate = 0.5
)

type Order struct {
	Type          string
	Amount        float64
	Pending       bool
	MonthsElapsed int
	TotalMonths   int
}
