package after

import "errors"

var ErrOrderNotFound = errors.New("order not found")

// OrderRepository is the port owned by the application layer; data adapters implement it.
type OrderRepository interface {
	Get(orderID int) (*Order, error)
	Save(order Order) error
}

// CancelOrder is the application service: loads the aggregate, calls domain
// behaviour, saves it.
type CancelOrder struct {
	Repository OrderRepository
}

func (c CancelOrder) Execute(orderID int) error {
	order, err := c.Repository.Get(orderID)
	if err != nil {
		return err
	}
	if order == nil {
		return ErrOrderNotFound
	}
	if err := order.Cancel(); err != nil {
		return err
	}
	return c.Repository.Save(*order)
}
