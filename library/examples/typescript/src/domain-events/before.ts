// before: cancel() calls three unrelated services inline — the aggregate imports all of them.
export class OrderAlreadyCancelledError extends Error {}

export interface InventoryService {
  release(orderId: number): void;
}

export interface Mailer {
  sendCancellationEmail(orderId: number): void;
}

export interface LoyaltyLedger {
  recordCancellation(orderId: number): void;
}

// Depends on three collaborators just to change its own status.
export class Order {
  status = "pending";

  constructor(
    public readonly id: number,
    private readonly inventory: InventoryService,
    private readonly mailer: Mailer,
    private readonly loyalty: LoyaltyLedger,
  ) {}

  cancel(reason: string): void {
    if (this.status === "cancelled") {
      throw new OrderAlreadyCancelledError("order is already cancelled");
    }
    // If any of these three calls throws, the ones before it already ran
    // and the ones after it never will — and status is set only at the end.
    this.inventory.release(this.id);
    this.mailer.sendCancellationEmail(this.id);
    this.loyalty.recordCancellation(this.id);
    this.status = "cancelled";
  }
}
