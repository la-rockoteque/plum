// before: the cancellation-eligibility rule is copy-pasted into a CLI and an API handler.
export const CANCELLATION_WINDOW_MS = 24 * 60 * 60 * 1000;

export enum OrderStatus {
  Pending = "pending",
  Shipped = "shipped",
  Cancelled = "cancelled",
}

export class Order {
  constructor(
    readonly id: number,
    readonly status: OrderStatus,
    readonly placedAtMs: number,
  ) {}
}

export interface Clock {
  nowMs(): number;
}

// Got the window check in a later bug fix.
export class CliCancelHandler {
  canCancel(order: Order, clock: Clock): boolean {
    if (order.status !== OrderStatus.Pending) return false;
    return clock.nowMs() - order.placedAtMs <= CANCELLATION_WINDOW_MS;
  }
}

// Copy-pasted from the CLI handler before the window check was added.
export class ApiCancelHandler {
  canCancel(order: Order, _clock: Clock): boolean {
    return order.status === OrderStatus.Pending;
  }
}
