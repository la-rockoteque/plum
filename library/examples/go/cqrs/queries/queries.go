package queries

import "example.com/repository-example/application"

type OrderSummary struct {
	ID        int
	Status    string
	CanCancel bool
}

type OrderSummaryReader interface {
	GetSummary(orderID int) (*OrderSummary, error)
}

type GetOrderSummary struct {
	reader OrderSummaryReader
}

func NewGetOrderSummary(reader OrderSummaryReader) GetOrderSummary {
	return GetOrderSummary{reader: reader}
}

func (q GetOrderSummary) Execute(orderID int) (*OrderSummary, error) {
	summary, err := q.reader.GetSummary(orderID)
	if err != nil {
		return nil, err
	}
	if summary == nil {
		return nil, application.ErrOrderNotFound
	}
	return summary, nil
}
