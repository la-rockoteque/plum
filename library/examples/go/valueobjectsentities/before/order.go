package before

// Order is built from bare primitives: Status and Total carry no rules of their own.
type Order struct {
	ID       int
	Status   string
	Total    float64
	Currency string
}

// AddTotals adds two orders' totals. Nothing here notices the currencies might differ.
func AddTotals(a, b Order) float64 {
	return a.Total + b.Total
}
