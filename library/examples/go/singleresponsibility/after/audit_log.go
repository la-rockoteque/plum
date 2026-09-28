package after

// AuditLog owns the audit entry format — its only reason to change.
type AuditLog struct {
	Entries []string
}

func (a *AuditLog) RecordCancelled(order *Order, reason string) {
	a.Entries = append(a.Entries, order.ID+"|CANCELLED|"+reason)
}
