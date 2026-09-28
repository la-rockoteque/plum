// Package refactor: same behaviour as green, named and in one place instead of a bare comparison inside Cancel.
// The public shape is identical to green: NewOrder takes a string, Order.Status is a string.
package refactor

import "errors"

// nonCancellableStatuses names the rule instead of a bare comparison inside Cancel — internal only.
var nonCancellableStatuses = map[string]bool{"shipped": true}

type Order struct {
	Status string
}

func NewOrder(status string) *Order {
	return &Order{Status: status}
}

func (o *Order) CanCancel() bool {
	return !nonCancellableStatuses[o.Status]
}

func (o *Order) Cancel() error {
	if !o.CanCancel() {
		return errors.New("a shipped order can't be cancelled")
	}
	o.Status = "cancelled"
	return nil
}
