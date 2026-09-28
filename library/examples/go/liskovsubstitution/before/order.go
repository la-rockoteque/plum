// Package before models the "subtype" the way Go can: Go has no inheritance,
// so GiftOrder is simply another type satisfying the same Order interface as
// StandardOrder, whose Cancel implementation rejects what the interface's
// implicit contract allows. See the concept's Language notes.
package before

import "errors"

type OrderStatus string

const (
	Pending   OrderStatus = "pending"
	Shipped   OrderStatus = "shipped"
	Cancelled OrderStatus = "cancelled"
)

var ErrShippedOrCancelledOrder = errors.New("cannot cancel a shipped or cancelled order")
var ErrGiftOrdersCannotBeCancelledOnline = errors.New("gift orders can't be cancelled online")

type Order interface {
	ID() int
	Status() OrderStatus
	Cancel(reason string) error
}

type StandardOrder struct {
	id     int
	status OrderStatus
}

func NewStandardOrder(id int, status OrderStatus) *StandardOrder {
	return &StandardOrder{id: id, status: status}
}

func (o *StandardOrder) ID() int            { return o.id }
func (o *StandardOrder) Status() OrderStatus { return o.status }

func (o *StandardOrder) Cancel(reason string) error {
	if o.status == Shipped || o.status == Cancelled {
		return ErrShippedOrCancelledOrder
	}
	o.status = Cancelled
	return nil
}

// GiftOrder strengthens Order's precondition: Cancel rejects every request,
// even while pending, where StandardOrder would accept it. A caller that
// only knows the Order contract can no longer assume cancelling a pending
// order succeeds.
type GiftOrder struct {
	id     int
	status OrderStatus
}

func NewGiftOrder(id int, status OrderStatus) *GiftOrder {
	return &GiftOrder{id: id, status: status}
}

func (o *GiftOrder) ID() int            { return o.id }
func (o *GiftOrder) Status() OrderStatus { return o.status }

func (o *GiftOrder) Cancel(reason string) error {
	return ErrGiftOrdersCannotBeCancelledOnline
}
