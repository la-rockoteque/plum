// Package refactor: same behaviour as green, named and in one place.
package refactor

import "errors"

type OrderStatus string

const (
	Pending   OrderStatus = "pending"
	Shipped   OrderStatus = "shipped"
	Cancelled OrderStatus = "cancelled"
)

// The rule, named instead of a string compare buried in Cancel.
var nonCancellableStatuses = map[OrderStatus]bool{Shipped: true}

type Order struct {
	Status OrderStatus
}

func NewOrder(status OrderStatus) *Order {
	return &Order{Status: status}
}

func (o *Order) CanCancel() bool {
	return !nonCancellableStatuses[o.Status]
}

func (o *Order) Cancel() error {
	if !o.CanCancel() {
		return errors.New("a shipped order can't be cancelled")
	}
	o.Status = Cancelled
	return nil
}
