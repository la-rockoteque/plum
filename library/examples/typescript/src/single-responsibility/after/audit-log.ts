import type { Order } from "./order.js";

// Owns the audit entry format — its only reason to change. Satisfies
// CancelOrder's Auditor port structurally; nothing declares it.
export class AuditLog {
  readonly entries: string[] = [];

  recordCancelled(order: Order, reason: string): void {
    this.entries.push(`${order.id}|CANCELLED|${reason}`);
  }
}
