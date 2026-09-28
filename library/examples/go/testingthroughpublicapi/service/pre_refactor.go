package service

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

func (s *PreRefactorService) calculateFee(order *Order) int {
	return int(float64(order.AmountMinor)*s.feeRate + 0.5)
}

func (s *PreRefactorService) transitionStatus(order *Order) {
	order.Status = Cancelled
}

func (s *PreRefactorService) Cancel(orderID int) (CancellationOutcome, error) {
	order, err := s.orders.FindByID(orderID)
	if err != nil {
		return CancellationOutcome{}, err
	}
	fee := s.calculateFee(order)
	s.transitionStatus(order)
	refund := order.AmountMinor - fee
	if err := s.notifier.Send(s.formatter.format(orderID, refund)); err != nil {
		return CancellationOutcome{}, err
	}
	if err := s.orders.Save(order); err != nil {
		return CancellationOutcome{}, err
	}
	return CancellationOutcome{OrderID: orderID, RefundAmountMinor: refund, Status: order.Status}, nil
}
