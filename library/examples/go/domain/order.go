package domain

import "errors"

type OrderStatus string

const (
	Pending   OrderStatus = "pending"
	Cancelled OrderStatus = "cancelled"
)

var ErrOrderAlreadyCancelled = errors.New("order already cancelled")

type Order struct {
	ID     int
	Status OrderStatus
}

func (o *Order) Cancel() error {
	if o.Status == Cancelled {
		return ErrOrderAlreadyCancelled
	}
	o.Status = Cancelled
	return nil
}
