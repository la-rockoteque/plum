package before

import (
	"errors"
	"strconv"
)

type OrderStatus string

const (
	Pending   OrderStatus = "pending"
	Shipped   OrderStatus = "shipped"
	Cancelled OrderStatus = "cancelled"
)

type Order struct {
	ID            int
	CustomerName  string
	CustomerEmail string
	Status        OrderStatus
}

var ErrShippedOrCancelledOrder = errors.New("cannot cancel a shipped or cancelled order")

// OrderService cancels an order, formats the customer email, and writes the
// audit log — three reasons to change: the cancellation rule, the email
// wording, and the audit format.
type OrderService struct {
	SentEmails []string
	AuditLog   []string
}

func (s *OrderService) Cancel(order *Order, reason string) error {
	if order.Status == Shipped || order.Status == Cancelled {
		return ErrShippedOrCancelledOrder
	}
	order.Status = Cancelled
	id := strconv.Itoa(order.ID)
	s.SentEmails = append(s.SentEmails, "Dear "+order.CustomerName+", your order "+id+
		" was cancelled. Reason: "+reason+".")
	s.AuditLog = append(s.AuditLog, id+"|CANCELLED|"+reason)
	return nil
}
