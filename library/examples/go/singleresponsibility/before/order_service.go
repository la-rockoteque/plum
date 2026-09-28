package before

import "errors"

type Order struct {
	ID            string
	CustomerName  string
	CustomerEmail string
	Status        string
}

var ErrShippedOrder = errors.New("cannot cancel a shipped order")

// OrderService cancels an order, formats the customer email, and writes the
// audit log — three reasons to change: the cancellation rule, the email
// wording, and the audit format.
type OrderService struct {
	SentEmails []string
	AuditLog   []string
}

func (s *OrderService) Cancel(order *Order, reason string) error {
	if order.Status == "shipped" {
		return ErrShippedOrder
	}
	order.Status = "cancelled"
	s.SentEmails = append(s.SentEmails, "Dear "+order.CustomerName+", your order "+order.ID+
		" was cancelled. Reason: "+reason+".")
	s.AuditLog = append(s.AuditLog, order.ID+"|CANCELLED|"+reason)
	return nil
}
