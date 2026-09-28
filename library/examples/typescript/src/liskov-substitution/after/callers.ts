import type { CancellableOrder } from "./order.js";

// Depends only on CancellableOrder, so it works for every subtype that
// implements it — no instanceof check, and no way to hand it a GiftOrder
// by mistake.
export class CancelExpiredOrders {
  execute(orders: CancellableOrder[], reason: string): number[] {
    const cancelled: number[] = [];
    for (const order of orders) {
      order.cancel(reason);
      cancelled.push(order.id);
    }
    return cancelled;
  }
}

// Same capability, same absence of type checks.
export class CustomerServiceCancelTool {
  cancel(order: CancellableOrder, reason: string): string {
    order.cancel(reason);
    return `order ${order.id} cancelled: ${reason}`;
  }
}
