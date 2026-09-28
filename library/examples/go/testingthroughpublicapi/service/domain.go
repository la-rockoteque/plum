// Package service holds two behaviour-identical implementations of an order-cancellation
// service: PreRefactorService and PostRefactorService. Only their private shape differs.
package service

import "fmt"

type OrderStatus string

const (
	Pending   OrderStatus = "pending"
	Shipped   OrderStatus = "shipped"
	Cancelled OrderStatus = "cancelled"
)

type Order struct {
	ID          int
	AmountMinor int
	Status      OrderStatus
}

func NewOrder(id int, amountMinor int) *Order {
	return &Order{ID: id, AmountMinor: amountMinor, Status: Pending}
}

type OrderRepository interface {
	FindByID(orderID int) (*Order, error)
	Save(order *Order) error
}

type Notifier interface {
	Send(message string) error
}

type CancellationOutcome struct {
	OrderID           int
	RefundAmountMinor int
	Status            OrderStatus
}

// formatter is the unit's own internal collaborator: constructed by the service, never injected.
type formatter interface {
	format(orderID int, refundAmountMinor int) string
}

// defaultFormatter is the production formatter every service builds for itself.
type defaultFormatter struct{}

func (defaultFormatter) format(orderID int, refundAmountMinor int) string {
	return fmt.Sprintf("Order %d cancelled; refund %d", orderID, refundAmountMinor)
}
