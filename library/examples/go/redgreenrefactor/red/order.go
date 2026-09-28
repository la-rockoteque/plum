// Package red: no rule yet. Any status can be cancelled.
package red

type Order struct {
	Status string
}

func NewOrder(status string) *Order {
	return &Order{Status: status}
}

func (o *Order) Cancel() {
	o.Status = "cancelled"
}
