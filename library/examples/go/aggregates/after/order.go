package after

import "errors"

const MaxLines = 10

var (
	ErrOrderCancelled  = errors.New("cannot modify a cancelled order")
	ErrInvalidQuantity = errors.New("quantity must be at least 1")
	ErrTooManyLines    = errors.New("an order can have at most 10 lines")
	ErrLineNotFound    = errors.New("no such line")
)

// OrderLine is held only inside the aggregate; callers only ever see copies of it.
type OrderLine struct {
	ID             int
	SKU            string
	Quantity       int
	UnitPriceMinor int
	Currency       string
}

// Order is the aggregate root: the only entry point for reading or changing its lines.
type Order struct {
	ID         int
	status     string
	currency   string
	lines      []OrderLine
	nextLineID int
}

func NewOrder(id int) *Order {
	return &Order{ID: id, status: "pending", currency: "USD", nextLineID: 1}
}

func (o *Order) Status() string {
	return o.status
}

// Lines returns copies: mutating the result can never change the aggregate's state.
func (o *Order) Lines() []OrderLine {
	result := make([]OrderLine, len(o.lines))
	copy(result, o.lines)
	return result
}

// TotalMinor is always derived from the current lines — never a cache that can go stale.
func (o *Order) TotalMinor() int {
	total := 0
	for _, line := range o.lines {
		total += line.Quantity * line.UnitPriceMinor
	}
	return total
}

func (o *Order) AddLine(sku string, quantity int, unitPriceMinor int) (int, error) {
	if err := o.guardNotCancelled(); err != nil {
		return 0, err
	}
	if err := guardQuantity(quantity); err != nil {
		return 0, err
	}
	if len(o.lines) >= MaxLines {
		return 0, ErrTooManyLines
	}
	line := OrderLine{ID: o.nextLineID, SKU: sku, Quantity: quantity, UnitPriceMinor: unitPriceMinor, Currency: o.currency}
	o.nextLineID++
	o.lines = append(o.lines, line)
	return line.ID, nil
}

func (o *Order) ChangeQuantity(lineID int, quantity int) error {
	if err := o.guardNotCancelled(); err != nil {
		return err
	}
	if err := guardQuantity(quantity); err != nil {
		return err
	}
	index, err := o.indexOf(lineID)
	if err != nil {
		return err
	}
	o.lines[index].Quantity = quantity
	return nil
}

func (o *Order) RemoveLine(lineID int) error {
	if err := o.guardNotCancelled(); err != nil {
		return err
	}
	index, err := o.indexOf(lineID)
	if err != nil {
		return err
	}
	o.lines = append(o.lines[:index], o.lines[index+1:]...)
	return nil
}

func (o *Order) Cancel() {
	o.status = "cancelled"
}

func (o *Order) indexOf(lineID int) (int, error) {
	for i, line := range o.lines {
		if line.ID == lineID {
			return i, nil
		}
	}
	return 0, ErrLineNotFound
}

func (o *Order) guardNotCancelled() error {
	if o.status == "cancelled" {
		return ErrOrderCancelled
	}
	return nil
}

func guardQuantity(quantity int) error {
	if quantity < 1 {
		return ErrInvalidQuantity
	}
	return nil
}

// OrderRepository is one repository per aggregate: it saves and loads the whole Order, not individual lines.
type OrderRepository struct {
	orders map[int]*Order
}

func NewOrderRepository() *OrderRepository {
	return &OrderRepository{orders: make(map[int]*Order)}
}

func (r *OrderRepository) Save(order *Order) {
	r.orders[order.ID] = order
}

func (r *OrderRepository) Get(orderID int) (*Order, bool) {
	order, ok := r.orders[orderID]
	return order, ok
}
