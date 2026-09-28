package memory

import "example.com/repository-example/domain"

type OrderRepository struct {
	orders map[int]domain.Order
}

func NewOrderRepository() *OrderRepository {
	return &OrderRepository{orders: make(map[int]domain.Order)}
}

func (r *OrderRepository) Get(orderID int) (*domain.Order, error) {
	order, ok := r.orders[orderID]
	if !ok {
		return nil, nil
	}
	return &order, nil
}

func (r *OrderRepository) Save(order domain.Order) error {
	r.orders[order.ID] = order
	return nil
}
