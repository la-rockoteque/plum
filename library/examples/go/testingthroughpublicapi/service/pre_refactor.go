package service

import "math"

// PreRefactorService: before the refactor, a separate fee helper and a plainly-named rate field.
type PreRefactorService struct {
	orders    OrderRepository
	notifier  Notifier
	feeRate   float64
	formatter formatter
}

func NewPreRefactorService(orders OrderRepository, notifier Notifier) *PreRefactorService {
	return &PreRefactorService{orders: orders, notifier: notifier, feeRate: 0.1, formatter: defaultFormatter{}}
}

func (s *PreRefactorService) calculateFee(order *Order) float64 {
	return math.Round(order.Total*s.feeRate*100) / 100
}

func (s *PreRefactorService) transitionStatus(order *Order) {
	order.Status = "cancelled"
}

func (s *PreRefactorService) Cancel(orderID string) (CancellationOutcome, error) {
	order, err := s.orders.FindByID(orderID)
	if err != nil {
		return CancellationOutcome{}, err
	}
	fee := s.calculateFee(order)
	s.transitionStatus(order)
	refund := math.Round((order.Total-fee)*100) / 100
	if err := s.notifier.Send(s.formatter.format(orderID, refund)); err != nil {
		return CancellationOutcome{}, err
	}
	if err := s.orders.Save(order); err != nil {
		return CancellationOutcome{}, err
	}
	return CancellationOutcome{OrderID: orderID, RefundAmount: refund, Status: order.Status}, nil
}
