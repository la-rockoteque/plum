// Package after: every collaborator is a port. The composition root decides which
// double or adapter plugs in.
package after

import "fmt"

type OrderStatus string

const (
	StatusPending   OrderStatus = "pending"
	StatusShipped   OrderStatus = "shipped"
	StatusCancelled OrderStatus = "cancelled"
)

type ChargeResult string

const (
	ChargeApproved ChargeResult = "approved"
	ChargeDeclined ChargeResult = "declined"
)

type Order struct {
	ID            int
	CustomerEmail string
	AmountMinor   int
	Status        OrderStatus
}

func NewOrder(id int, customerEmail string, amountMinor int) *Order {
	return &Order{ID: id, CustomerEmail: customerEmail, AmountMinor: amountMinor, Status: StatusPending}
}

type OrderRepository interface {
	Get(orderID int) (*Order, error)
	Save(order *Order) error
}

type PaymentGateway interface {
	Charge(orderID int, amountMinor int) (ChargeResult, error)
}

type Mailer interface {
	Send(to, message string) error
}

type AuditLogger interface {
	Log(message string) error
}

type CancelOrder struct {
	Orders      OrderRepository
	Gateway     PaymentGateway
	Mailer      Mailer
	AuditLogger AuditLogger
}

func (c CancelOrder) Execute(orderID int) error {
	order, err := c.Orders.Get(orderID)
	if err != nil {
		return err
	}
	result, err := c.Gateway.Charge(order.ID, order.AmountMinor)
	if err != nil {
		return err
	}
	if result == ChargeDeclined {
		// A declined charge is a legitimate business outcome, not a crash: the audit
		// logger is a real collaborator on this path, even though the happy path never
		// touches it.
		return c.AuditLogger.Log(fmt.Sprintf("charge declined for order %d", order.ID))
	}
	order.Status = StatusCancelled
	if err := c.Mailer.Send(order.CustomerEmail, fmt.Sprintf("Your order %d was cancelled", order.ID)); err != nil {
		return err
	}
	return c.Orders.Save(order)
}
