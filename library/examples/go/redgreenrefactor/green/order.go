// Package green: minimal fix, a bare status-string comparison right where Cancel decides.
package green

import "errors"

type Order struct {
	Status string
}

func NewOrder(status string) *Order {
	return &Order{Status: status}
}

func (o *Order) Cancel() error {
	if o.Status == "shipped" {
		return errors.New("a shipped order can't be cancelled")
	}
	o.Status = "cancelled"
	return nil
}
