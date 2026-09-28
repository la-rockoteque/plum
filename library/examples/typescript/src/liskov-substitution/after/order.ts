export type OrderStatus = "pending" | "shipped" | "cancelled";

export interface Order {
  readonly id: number;
  readonly status: OrderStatus;
}

// The capability a caller actually needs: only order types that can honour
// it (pending -> cancelled, shipped/cancelled -> rejected) implement it.
// Order itself carries no cancel() — cancellation is opt-in.
export interface CancellableOrder extends Order {
  cancel(reason: string): void;
}

export class StandardOrder implements CancellableOrder {
  status: OrderStatus;

  constructor(
    public readonly id: number,
    status: OrderStatus = "pending",
  ) {
    this.status = status;
  }

  cancel(_reason: string): void {
    if (this.status === "shipped" || this.status === "cancelled") {
      throw new Error("cannot cancel a shipped or cancelled order");
    }
    this.status = "cancelled";
  }
}

// A second, independent type that satisfies CancellableOrder the same way
// StandardOrder does — proving the contract, not a single class, is what
// callers depend on.
export class SubscriptionOrder extends StandardOrder {}

// Shares Order's shape (id, status) but has no cancel() method: it does not
// implement CancellableOrder at all. The domain still considers it an
// order; the type system no longer lets it reach cancel().
export class GiftOrder implements Order {
  constructor(
    public readonly id: number,
    public readonly status: OrderStatus = "pending",
  ) {}
}
