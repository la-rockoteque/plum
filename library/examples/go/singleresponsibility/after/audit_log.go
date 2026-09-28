package after

import "strconv"

// AuditLog owns the audit entry format — its only reason to change.
// Satisfies CancelOrder's Auditor port structurally; nothing declares it.
type AuditLog struct {
	Entries []string
}

func (a *AuditLog) RecordCancelled(order *Order, reason string) {
	a.Entries = append(a.Entries, strconv.Itoa(order.ID)+"|CANCELLED|"+reason)
}
