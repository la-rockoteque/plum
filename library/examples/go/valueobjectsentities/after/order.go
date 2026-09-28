package after

import (
	"errors"
	"fmt"
)

// ErrInvalidStatusTransition marks an illegal move between two known statuses.
var ErrInvalidStatusTransition = errors.New("invalid order status transition")

// ErrUnknownStatus marks a status string that doesn't name a legal state at all.
var ErrUnknownStatus = errors.New("unknown order status")

// OrderStatus is a value object: only these states exist, and only some moves between them are legal.
type OrderStatus string

const (
	Pending   OrderStatus = "pending"
	Shipped   OrderStatus = "shipped"
	Cancelled OrderStatus = "cancelled"
)

func ParseOrderStatus(value string) (OrderStatus, error) {
	switch OrderStatus(value) {
	case Pending, Shipped, Cancelled:
		return OrderStatus(value), nil
	default:
		return "", fmt.Errorf("%w: %q", ErrUnknownStatus, value)
	}
}

func (s OrderStatus) TransitionTo(target OrderStatus) (OrderStatus, error) {
	if s == Pending && (target == Shipped || target == Cancelled) {
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
// status is unexported: the only way to change it is Ship()/Cancel(), which enforce legal
// transitions. There is no exported setter, so a caller in another package can't reach in and
// reset it directly.
type Order struct {
	ID     int
	status OrderStatus
	Total  Money
}

func NewOrder(id int, status OrderStatus, total Money) Order {
	return Order{ID: id, status: status, Total: total}
}

func (o Order) Status() OrderStatus { return o.status }

func (o *Order) Ship() error {
	next, err := o.status.TransitionTo(Shipped)
	if err != nil {
		return err
	}
	o.status = next
	return nil
}

func (o *Order) Cancel() error {
	next, err := o.status.TransitionTo(Cancelled)
	if err != nil {
		return err
	}
	o.status = next
	return nil
}

// Equals compares identity, not attributes: only the ID decides whether two Orders are the same order.
func (o Order) Equals(other Order) bool {
	return o.ID == other.ID
}
