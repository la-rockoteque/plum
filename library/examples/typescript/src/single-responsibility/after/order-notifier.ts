import type { Order } from "./order.js";

// Owns the wording of the cancellation email — its only reason to change.
export class OrderNotifier {
  readonly sent: string[] = [];

  notifyCancelled(order: Order, reason: string): void {
    this.sent.push(
      `Dear ${order.customerName}, your order ${order.id} was cancelled. Reason: ${reason}.`,
    );
  }
}
