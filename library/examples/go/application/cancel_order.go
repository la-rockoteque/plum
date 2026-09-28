package application

import "errors"

var ErrOrderNotFound = errors.New("order not found")

type CancelOrder struct {
	repository OrderRepository
}

func NewCancelOrder(repository OrderRepository) CancelOrder {
	return CancelOrder{repository: repository}
}

func (c CancelOrder) Execute(orderID int) error {
	order, err := c.repository.Get(orderID)
	if err != nil {
		return err
	}
	if order == nil {
		return ErrOrderNotFound
	}
	if err := order.Cancel(); err != nil {
		return err
	}
	return c.repository.Save(*order)
}
