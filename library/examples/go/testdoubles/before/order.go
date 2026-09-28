// Package before: CancelOrder constructs its own collaborators. No test can observe
// anything but the crash.
package before

import "errors"

// SmtpMailer stands in for a real SMTP client: this library never opens a socket.
type SmtpMailer struct{}

func (SmtpMailer) Send(to, message string) error {
	return errors.New("network unavailable")
}

// HttpPaymentGateway stands in for a real payment-gateway HTTP client.
type HttpPaymentGateway struct{}

func (HttpPaymentGateway) Charge(orderID string, amount float64) error {
	return errors.New("network unavailable")
}

type Order struct {
	ID              string
	CustomerEmail   string
	CancellationFee float64
	Status          string
}

func NewOrder(id, customerEmail string, cancellationFee float64) *Order {
	return &Order{ID: id, CustomerEmail: customerEmail, CancellationFee: cancellationFee, Status: "placed"}
}

type CancelOrder struct {
	gateway HttpPaymentGateway
	mailer  SmtpMailer
}

func (c CancelOrder) Execute(order *Order) error {
	if err := c.gateway.Charge(order.ID, order.CancellationFee); err != nil {
		return err
	}
	order.Status = "cancelled"
	return c.mailer.Send(order.CustomerEmail, "Your order "+order.ID+" was cancelled")
}
