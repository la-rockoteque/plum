export type OrderStatus = "pending" | "shipped" | "cancelled";

// The rule, named and in one place instead of a string compare buried in cancel().
const NON_CANCELLABLE_STATUSES: ReadonlySet<OrderStatus> = new Set(["shipped"]);

export class Order {
  status: OrderStatus;

  constructor(status: OrderStatus = "pending") {
    this.status = status;
  }

  canCancel(): boolean {
    return !NON_CANCELLABLE_STATUSES.has(this.status);
  }

  cancel(): void {
    if (!this.canCancel()) throw new Error("a shipped order can't be cancelled");
    this.status = "cancelled";
  }
}
