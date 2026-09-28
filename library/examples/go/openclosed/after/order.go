// Package after: cancellation fees and refund descriptions vary by order type.
package after

const (
	Standard     = "standard"
	Express      = "express"
	CustomMade   = "custom-made"
	Subscription = "subscription"
)

type Order struct {
	Type          string
	Amount        float64
	Pending       bool
	MonthsElapsed int
	TotalMonths   int
}
