import type { AuditLog } from "./audit-log.js";
import type { Order } from "./order.js";
import type { OrderNotifier } from "./order-notifier.js";

// Owns only the cancellation rule; notifying and auditing are delegated to
// its collaborators.
export class CancelOrder {
  constructor(
    private readonly notifier: OrderNotifier,
    private readonly auditLog: AuditLog,
  ) {}

  execute(order: Order, reason: string): void {
    if (order.status === "shipped") throw new Error("cannot cancel a shipped order");
    order.status = "cancelled";
    this.notifier.notifyCancelled(order, reason);
    this.auditLog.recordCancelled(order, reason);
  }
}
