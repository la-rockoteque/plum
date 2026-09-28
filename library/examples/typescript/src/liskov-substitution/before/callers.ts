import { GiftOrder, Order } from "./order.js";

// Written against the Order contract. Because GiftOrder strengthens that
// contract's precondition, this caller has to know about GiftOrder by name
// to avoid the broken cancellation.
export class CancelExpiredOrders {
  execute(orders: Order[], reason: string): { cancelled: number[]; skipped: number[] } {
    const cancelled: number[] = [];
    const skipped: number[] = [];
    for (const order of orders) {
      if (order instanceof GiftOrder) {
        skipped.push(order.id);
        continue;
      }
      order.cancel(reason);
      cancelled.push(order.id);
    }
    return { cancelled, skipped };
  }
}

// A second caller against the same Order contract, forced to grow the same
// type check as CancelExpiredOrders — the change cost of the violation is
// paid twice.
export class CustomerServiceCancelTool {
  cancel(order: Order, reason: string): string {
    if (order instanceof GiftOrder) {
      return `order ${order.id} must be cancelled by phone: gift orders can't be cancelled online`;
    }
    order.cancel(reason);
    return `order ${order.id} cancelled: ${reason}`;
  }
}
