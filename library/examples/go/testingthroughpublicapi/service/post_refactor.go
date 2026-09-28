package service

import "math"

// PostRefactorService: after a behaviour-preserving refactor, the fee helper is inlined and the
// rate field renamed. A caller of Cancel cannot tell this apart from PreRefactorService - same
// inputs, same outcome, same stored state, same notification. Only the private shape changed.
type PostRefactorService struct {
	orders              OrderRepository
	notifier            Notifier
	cancellationFeeRate float64
	formatter           formatter
}

func NewPostRefactorService(orders OrderRepository, notifier Notifier) *PostRefactorService {
	return &PostRefactorService{orders: orders, notifier: notifier, cancellationFeeRate: 0.1, formatter: defaultFormatter{}}
}

func (s *PostRefactorService) transitionStatus(order *Order) {
	order.Status = "cancelled"
}

func (s *PostRefactorService) Cancel(orderID string) (CancellationOutcome, error) {
	order, err := s.orders.FindByID(orderID)
	if err != nil {
		return CancellationOutcome{}, err
	}
	fee := math.Round(order.Total*s.cancellationFeeRate*100) / 100 // calculateFee() inlined here
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
