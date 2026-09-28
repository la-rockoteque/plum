package memory

import (
	"example.com/repository-example/cqrs/queries"
	"example.com/repository-example/domain"
	"example.com/repository-example/infrastructure/memory"
)

type OrderSummaryReader struct {
	repository *memory.OrderRepository
}

func NewOrderSummaryReader(repository *memory.OrderRepository) OrderSummaryReader {
	return OrderSummaryReader{repository: repository}
}

func (r OrderSummaryReader) GetSummary(orderID int) (*queries.OrderSummary, error) {
	order, err := r.repository.Get(orderID)
	if err != nil || order == nil {
		return nil, err
	}
	return &queries.OrderSummary{
		ID: order.ID, Status: string(order.Status), CanCancel: order.Status == domain.Pending,
	}, nil
}
