package after

import "errors"

var ErrShippedOrder = errors.New("cannot cancel a shipped order")

// CancelOrder owns only the cancellation rule; notifying and auditing are
// delegated to its collaborators.
type CancelOrder struct {
	Notifier *OrderNotifier
	AuditLog *AuditLog
}

func NewCancelOrder(notifier *OrderNotifier, auditLog *AuditLog) *CancelOrder {
	return &CancelOrder{Notifier: notifier, AuditLog: auditLog}
}

func (c *CancelOrder) Execute(order *Order, reason string) error {
	if order.Status == "shipped" {
		return ErrShippedOrder
	}
	order.Status = "cancelled"
	c.Notifier.NotifyCancelled(order, reason)
	c.AuditLog.RecordCancelled(order, reason)
	return nil
}
