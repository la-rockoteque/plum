// Package after: every collaborator is a port. The composition root decides which
// double or adapter plugs in.
package after

type Order struct {
	ID              string
	CustomerEmail   string
	CancellationFee float64
	Status          string
}

func NewOrder(id, customerEmail string, cancellationFee float64) *Order {
	return &Order{ID: id, CustomerEmail: customerEmail, CancellationFee: cancellationFee, Status: "placed"}
}

type OrderRepository interface {
	FindByID(orderID string) (*Order, error)
	Save(order *Order) error
}

type PaymentGateway interface {
	Charge(orderID string, amount float64) error
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
	AuditLogger AuditLogger // never called: a dummy satisfies this field in tests
}

func (c CancelOrder) Execute(orderID string) error {
	order, err := c.Orders.FindByID(orderID)
	if err != nil {
		return err
	}
	if err := c.Gateway.Charge(order.ID, order.CancellationFee); err != nil {
		return err
	}
	order.Status = "cancelled"
	if err := c.Mailer.Send(order.CustomerEmail, "Your order "+order.ID+" was cancelled"); err != nil {
		return err
	}
	return c.Orders.Save(order)
}
