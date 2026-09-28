import type { Order } from "./order.js";

export interface Notifier {
  notifyCancelled(order: Order, reason: string): void;
}

export interface Auditor {
  recordCancelled(order: Order, reason: string): void;
}

// Owns only the cancellation rule; notifying and auditing are delegated to
// ports it declares, not to concrete collaborators.
export class CancelOrder {
  constructor(
    private readonly notifier: Notifier,
    private readonly auditLog: Auditor,
  ) {}

  execute(order: Order, reason: string): void {
    if (order.status === "shipped" || order.status === "cancelled") {
      throw new Error("cannot cancel a shipped or cancelled order");
    }
    order.status = "cancelled";
    this.notifier.notifyCancelled(order, reason);
    this.auditLog.recordCancelled(order, reason);
  }
}
