package after

import "errors"

const MaxLines = 10

type OrderStatus string

const (
	Pending   OrderStatus = "pending"
	Shipped   OrderStatus = "shipped"
	Cancelled OrderStatus = "cancelled"
)

var (
	ErrOrderCancelled   = errors.New("cannot modify a cancelled order")
	ErrInvalidQuantity  = errors.New("quantity must be at least 1")
	ErrTooManyLines     = errors.New("an order can have at most 10 lines")
	ErrLineNotFound     = errors.New("no such line")
	ErrCurrencyMismatch = errors.New("line currency does not match order currency")
)

// OrderLine is held only inside the aggregate; callers only ever see copies of it.
type OrderLine struct {
	ID             int
	SKU            string
	Quantity       int
	UnitPriceMinor int
}

// Order is the aggregate root: the only entry point for reading or changing its lines.
type Order struct {
	ID         int
	status     OrderStatus
	currency   string
	lines      []OrderLine
	nextLineID int
}

func NewOrder(id int, status OrderStatus) *Order {
	return &Order{ID: id, status: status, currency: "USD", nextLineID: 1}
}

func (o *Order) Status() OrderStatus { return o.status }

// Lines returns copies: mutating the result can never change the aggregate's state.
func (o *Order) Lines() []OrderLine { return append([]OrderLine{}, o.lines...) }

// TotalMinor is always derived from the current lines — never a cache that can go stale.
func (o *Order) TotalMinor() int {
	total := 0
	for _, line := range o.lines {
		total += line.Quantity * line.UnitPriceMinor
	}
	return total
}

func (o *Order) AddLine(sku string, quantity int, unitPriceMinor int, currency string) (int, error) {
	if err := o.guard(quantity); err != nil {
		return 0, err
	}
	if currency != o.currency {
		return 0, ErrCurrencyMismatch
	}
	if len(o.lines) >= MaxLines {
		return 0, ErrTooManyLines
	}
	line := OrderLine{ID: o.nextLineID, SKU: sku, Quantity: quantity, UnitPriceMinor: unitPriceMinor}
	o.nextLineID++
	o.lines = append(o.lines, line)
	return line.ID, nil
}

func (o *Order) ChangeQuantity(lineID int, quantity int) error {
	if err := o.guard(quantity); err != nil {
		return err
	}
	for i := range o.lines {
		if o.lines[i].ID == lineID {
			o.lines[i].Quantity = quantity
			return nil
		}
	}
	return ErrLineNotFound
}

// Cancel enforces the aggregate's own invariant: a shipped or already-cancelled order can't be cancelled.
func (o *Order) Cancel() error {
	if o.status != Pending {
		return ErrOrderCancelled
	}
	o.status = Cancelled
	return nil
}

// Copy is a detached copy: used by the repository so a stored order is never a live reference.
func (o *Order) Copy() *Order {
	clone := NewOrder(o.ID, o.status)
	clone.lines = o.Lines()
	clone.nextLineID = o.nextLineID
	return clone
}

func (o *Order) guard(quantity int) error {
	if o.status == Cancelled {
		return ErrOrderCancelled
	}
	if quantity < 1 {
		return ErrInvalidQuantity
	}
	return nil
}

// OrderRepository is one repository per aggregate: it saves and loads the whole Order, not individual lines.
type OrderRepository struct {
	orders map[int]*Order
}

func NewOrderRepository() *OrderRepository { return &OrderRepository{orders: make(map[int]*Order)} }

func (r *OrderRepository) Save(order *Order) { r.orders[order.ID] = order.Copy() }

func (r *OrderRepository) Get(orderID int) (*Order, bool) {
	order, ok := r.orders[orderID]
	if !ok {
		return nil, false
	}
	return order.Copy(), true
}
