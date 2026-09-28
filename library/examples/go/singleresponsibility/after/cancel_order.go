package after

import "errors"

var ErrShippedOrCancelledOrder = errors.New("cannot cancel a shipped or cancelled order")

type Notifier interface {
	NotifyCancelled(order *Order, reason string)
}

type Auditor interface {
	RecordCancelled(order *Order, reason string)
}

// CancelOrder owns only the cancellation rule; notifying and auditing are
// delegated to ports it declares, not to concrete collaborators.
type CancelOrder struct {
	Notifier Notifier
	AuditLog Auditor
}

func NewCancelOrder(notifier Notifier, auditLog Auditor) *CancelOrder {
	return &CancelOrder{Notifier: notifier, AuditLog: auditLog}
}

func (c *CancelOrder) Execute(order *Order, reason string) error {
	if order.Status == Shipped || order.Status == Cancelled {
		return ErrShippedOrCancelledOrder
	}
	order.Status = Cancelled
	c.Notifier.NotifyCancelled(order, reason)
	c.AuditLog.RecordCancelled(order, reason)
	return nil
}
