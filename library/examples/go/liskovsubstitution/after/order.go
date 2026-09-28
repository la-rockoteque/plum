package after

import "errors"

type OrderStatus string

const (
	Pending   OrderStatus = "pending"
	Shipped   OrderStatus = "shipped"
	Cancelled OrderStatus = "cancelled"
)

var ErrShippedOrCancelledOrder = errors.New("cannot cancel a shipped or cancelled order")

// Order is the shape every order variant shares. Cancellation is not part
// of it: it's a separate capability below.
type Order interface {
	ID() int
	Status() OrderStatus
}

// CancellableOrder is the capability a caller actually needs: only order
// types that can honour it (pending -> cancelled, shipped/cancelled ->
// rejected) implement it.
type CancellableOrder interface {
	Order
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

// SubscriptionOrder is a second, independent type that satisfies
// CancellableOrder the same way StandardOrder does — proving the contract,
// not a single type, is what callers depend on.
type SubscriptionOrder struct {
	StandardOrder
}

func NewSubscriptionOrder(id int, status OrderStatus) *SubscriptionOrder {
	return &SubscriptionOrder{StandardOrder: StandardOrder{id: id, status: status}}
}

// GiftOrder shares Order's shape (ID, Status) but has no Cancel method: it
// does not satisfy CancellableOrder at all. The domain still considers it
// an order; the type system no longer lets it reach Cancel.
type GiftOrder struct {
	id     int
	status OrderStatus
}

func NewGiftOrder(id int, status OrderStatus) *GiftOrder {
	return &GiftOrder{id: id, status: status}
}

func (o *GiftOrder) ID() int            { return o.id }
func (o *GiftOrder) Status() OrderStatus { return o.status }
