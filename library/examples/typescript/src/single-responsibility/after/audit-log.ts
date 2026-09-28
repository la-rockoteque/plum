import type { Order } from "./order.js";

// Owns the audit entry format — its only reason to change.
export class AuditLog {
  readonly entries: string[] = [];

  recordCancelled(order: Order, reason: string): void {
    this.entries.push(`${order.id}|CANCELLED|${reason}`);
  }
}
