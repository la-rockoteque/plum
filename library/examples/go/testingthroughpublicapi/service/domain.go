// Package service holds two behaviour-identical implementations of an order-cancellation
// service: PreRefactorService and PostRefactorService. Only their private shape differs.
package service

import "fmt"

type Order struct {
	ID     string
	Total  float64
	Status string
}

func NewOrder(id string, total float64) *Order {
	return &Order{ID: id, Total: total, Status: "placed"}
}

type OrderRepository interface {
	FindByID(orderID string) (*Order, error)
	Save(order *Order) error
}

type Notifier interface {
	Send(message string) error
}

type CancellationOutcome struct {
	OrderID      string
	RefundAmount float64
	Status       string
}

// formatter is the unit's own internal collaborator: constructed by the service, never injected.
type formatter interface {
	format(orderID string, refundAmount float64) string
}

// defaultFormatter is the production formatter every service builds for itself.
type defaultFormatter struct{}

func (defaultFormatter) format(orderID string, refundAmount float64) string {
	return fmt.Sprintf("Order %s cancelled; refund %.2f", orderID, refundAmount)
}
