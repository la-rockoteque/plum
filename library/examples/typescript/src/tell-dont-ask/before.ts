// Teaching artifact: three callers each ask Order for its state, decide in their own if, and
// set the fields back. The API handler gets it right; the nightly job forgets the refund; the
// admin tool never checks whether the order already shipped.

export enum OrderStatus {
  Pending = "pending",
  Shipped = "shipped",
  Cancelled = "cancelled",
}

export interface Clock {
  nowMs(): number;
}

export class Order {
  status: OrderStatus;
  cancelledAtMs: number | null = null;
  refundDueCents = 0;

  constructor(
    readonly id: number,
    status: OrderStatus,
    readonly amountPaidCents: number,
    readonly shippedAtMs: number | null = null,
  ) {
    this.status = status;
  }
}

// The customer-facing cancel endpoint. Gets the rule right.
export class ApiCancelHandler {
  cancel(order: Order, clock: Clock): void {
    if (order.status !== OrderStatus.Pending) return;
    order.status = OrderStatus.Cancelled;
    order.cancelledAtMs = clock.nowMs();
    order.refundDueCents = order.amountPaidCents;
  }
}

// Auto-cancels stale pending orders. Forgot to carry the refund forward.
export class NightlyCancelJob {
  cancel(order: Order, clock: Clock): void {
    if (order.status !== OrderStatus.Pending) return;
    order.status = OrderStatus.Cancelled;
    order.cancelledAtMs = clock.nowMs();
    // Bug: refundDueCents is never set, even though the customer paid.
  }
}

// Lets support force-cancel an order by id. Never checks the current status first.
export class AdminCancelTool {
  cancel(order: Order, clock: Clock): void {
    // Bug: no status check, so a shipped order can be "cancelled" too.
    order.status = OrderStatus.Cancelled;
    order.cancelledAtMs = clock.nowMs();
    order.refundDueCents = order.amountPaidCents;
  }
}
