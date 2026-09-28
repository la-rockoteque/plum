// Callers tell the order to cancel itself; Order owns the rule, the timestamp and the refund.
// Setters disappear, and the invalid transition (cancelling a shipped order) is rejected once,
// inside Order, instead of missed by whichever caller forgot to check.

export enum OrderStatus {
  Pending = "pending",
  Shipped = "shipped",
  Cancelled = "cancelled",
}

export interface Clock {
  nowMs(): number;
}

export class Order {
  private _status: OrderStatus;
  private _cancelledAtMs: number | null = null;
  private _refundDueCents = 0;

  constructor(
    readonly id: number,
    status: OrderStatus,
    readonly amountPaidCents: number,
    readonly shippedAtMs: number | null = null,
  ) {
    this._status = status;
  }

  get status(): OrderStatus {
    return this._status;
  }

  get cancelledAtMs(): number | null {
    return this._cancelledAtMs;
  }

  get refundDueCents(): number {
    return this._refundDueCents;
  }

  cancel(clock: Clock): void {
    if (this._status !== OrderStatus.Pending) {
      throw new Error(`cannot cancel an order with status ${this._status}`);
    }
    this._status = OrderStatus.Cancelled;
    this._cancelledAtMs = clock.nowMs();
    this._refundDueCents = this.amountPaidCents;
  }
}

export class ApiCancelHandler {
  cancel(order: Order, clock: Clock): void {
    order.cancel(clock);
  }
}

export class NightlyCancelJob {
  cancel(order: Order, clock: Clock): void {
    order.cancel(clock);
  }
}

export class AdminCancelTool {
  cancel(order: Order, clock: Clock): void {
    order.cancel(clock);
  }
}
