package after

import (
	"errors"
	"fmt"
)

// ErrInvalidStatusTransition marks an unknown status or an illegal move between statuses.
var ErrInvalidStatusTransition = errors.New("invalid order status transition")

// OrderStatus is a value object: only these states exist, and only some moves between them are legal.
type OrderStatus string

const (
	Pending   OrderStatus = "pending"
	Cancelled OrderStatus = "cancelled"
)

func ParseOrderStatus(value string) (OrderStatus, error) {
	switch OrderStatus(value) {
	case Pending, Cancelled:
		return OrderStatus(value), nil
	default:
		return "", fmt.Errorf("%w: unknown order status %q", ErrInvalidStatusTransition, value)
	}
}

func (s OrderStatus) TransitionTo(target OrderStatus) (OrderStatus, error) {
	if s == Pending && target == Cancelled {
		return target, nil
	}
	return "", fmt.Errorf("%w: cannot move from %s to %s", ErrInvalidStatusTransition, s, target)
}

// ErrCurrencyMismatch marks arithmetic attempted across two different currencies.
var ErrCurrencyMismatch = errors.New("currency mismatch")

// Money is a value object: a comparable struct (equal by value with ==), blind to
// arithmetic across currencies.
type Money struct {
	AmountMinor int64
	Currency    string
}

func (m Money) Add(other Money) (Money, error) {
	if other.Currency != m.Currency {
		return Money{}, fmt.Errorf("%w: cannot add %s to %s", ErrCurrencyMismatch, other.Currency, m.Currency)
	}
	return Money{AmountMinor: m.AmountMinor + other.AmountMinor, Currency: m.Currency}, nil
}

// Order is an entity: two Orders are the same order iff they share an ID, whatever their attributes.
type Order struct {
	ID     int
	Status OrderStatus
	Total  Money
}

func (o *Order) Cancel() error {
	next, err := o.Status.TransitionTo(Cancelled)
	if err != nil {
		return err
	}
	o.Status = next
	return nil
}

// Equals compares identity, not attributes: only the ID decides whether two Orders are the same order.
func (o Order) Equals(other Order) bool {
	return o.ID == other.ID
}
