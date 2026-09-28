package before

import (
	"example.com/repository-example/application"
	"example.com/repository-example/domain"
)

type OrderService struct {
	repository application.OrderRepository
}

func NewOrderService(repository application.OrderRepository) OrderService {
	return OrderService{repository: repository}
}

func (s OrderService) CancelAndGet(orderID int) (*domain.Order, error) {
	// One operation changes state and returns the write model to the caller.
	order, err := s.repository.Get(orderID)
	if err != nil {
		return nil, err
	}
	if order == nil {
		return nil, application.ErrOrderNotFound
	}
	if err := order.Cancel(); err != nil {
		return nil, err
	}
	if err := s.repository.Save(*order); err != nil {
		return nil, err
	}
	return order, nil
}
