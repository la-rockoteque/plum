// Package after: client-owned role interfaces. CancelOrderStore declares only what
// CancelOrder needs; a separate role interface exists for a different client.
package after

import "fmt"

type Order struct {
	ID            int
	CustomerEmail string
	AmountMinor   int
	Status        string
}

func NewOrder(id int, customerEmail string, amountMinor int) *Order {
	return &Order{ID: id, CustomerEmail: customerEmail, AmountMinor: amountMinor, Status: "pending"}
}

// CancelOrderStore is a role interface owned by CancelOrder: only what it needs,
// declared next to it.
type CancelOrderStore interface {
	Get(orderID int) (*Order, error)
	Save(order *Order) error
}

// OrderArchiver is a separate role interface for a different client. CancelOrder
// never sees it.
type OrderArchiver interface {
	Archive(orderID int) error
}

type CancelOrder struct {
	Store CancelOrderStore
}

func (c CancelOrder) Execute(orderID int) error {
	order, err := c.Store.Get(orderID)
	if err != nil {
		return err
	}
	order.Status = "cancelled"
	return c.Store.Save(order)
}

// OrderStoreAdapter implements several role interfaces at once; CancelOrder only ever
// depends on the narrow one (CancelOrderStore).
type OrderStoreAdapter struct {
	orders map[int]*Order
}

func NewOrderStoreAdapter() *OrderStoreAdapter {
	return &OrderStoreAdapter{orders: map[int]*Order{}}
}

func (a *OrderStoreAdapter) Get(orderID int) (*Order, error) {
	order, ok := a.orders[orderID]
	if !ok {
		return nil, fmt.Errorf("unknown order %d", orderID)
	}
	return order, nil
}

func (a *OrderStoreAdapter) Save(order *Order) error {
	a.orders[order.ID] = order
	return nil
}

func (a *OrderStoreAdapter) Archive(orderID int) error {
	order, err := a.Get(orderID)
	if err != nil {
		return err
	}
	order.Status = "archived"
	return nil
}
