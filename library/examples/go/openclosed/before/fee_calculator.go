package before

import "fmt"

// CancellationFeeCalculator: one switch on order.Type decides the fee — and
// it isn't the only one (see refund_description.go).
type CancellationFeeCalculator struct{}

func (CancellationFeeCalculator) CalculateFee(order Order) (float64, error) {
	switch order.Type {
	case Standard:
		if order.Pending {
			return 0.0, nil
		}
		return order.Amount, nil
	case Express:
		return ExpressFlatFee, nil
	case CustomMade:
		return order.Amount * CustomMadeFeeRate, nil
	case Subscription:
		return order.Amount * float64(order.MonthsElapsed) / float64(order.TotalMonths), nil
	default:
		return 0, fmt.Errorf("unhandled order type: %s", order.Type)
	}
}
