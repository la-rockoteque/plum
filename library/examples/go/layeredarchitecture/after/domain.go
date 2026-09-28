package after

import (
	"errors"
	"fmt"
)

type OrderStatus string

const (
	Pending   OrderStatus = "pending"
	Shipped   OrderStatus = "shipped"
	Cancelled OrderStatus = "cancelled"
)

var ErrOrderCannotBeCancelled = errors.New("order cannot be cancelled")

type Order struct {
	ID     int
	Status OrderStatus
}

func (o *Order) Cancel() error {
	if o.Status == Shipped || o.Status == Cancelled {
		return fmt.Errorf("order %d already %s: %w", o.ID, o.Status, ErrOrderCannotBeCancelled)
	}
	o.Status = Cancelled
	return nil
}
