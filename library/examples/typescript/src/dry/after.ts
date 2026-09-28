// after: the rule lives once, on the order; both handlers call it.
export const CANCELLATION_WINDOW_MS = 24 * 60 * 60 * 1000;

export enum OrderStatus {
  Pending = "pending",
  Shipped = "shipped",
  Cancelled = "cancelled",
}

export interface Clock {
  nowMs(): number;
}

export class Order {
  constructor(
    readonly id: number,
    readonly status: OrderStatus,
    readonly placedAtMs: number,
  ) {}

  canBeCancelled(clock: Clock): boolean {
    if (this.status !== OrderStatus.Pending) return false;
    return clock.nowMs() - this.placedAtMs <= CANCELLATION_WINDOW_MS;
  }
}

export class CliCancelHandler {
  canCancel(order: Order, clock: Clock): boolean {
    return order.canBeCancelled(clock);
  }
}

export class ApiCancelHandler {
  canCancel(order: Order, clock: Clock): boolean {
    return order.canBeCancelled(clock);
  }
}
