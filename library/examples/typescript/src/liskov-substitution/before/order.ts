export type OrderStatus = "pending" | "shipped" | "cancelled";

export class Order {
  status: OrderStatus;

  constructor(
    public readonly id: number,
    public readonly customerName: string,
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

// Strengthens Order's precondition: cancel() rejects every request, even
// while pending, where the base class would accept it. A caller that only
// knows the Order contract can no longer assume cancelling a pending order
// succeeds.
export class GiftOrder extends Order {
  override cancel(_reason: string): void {
    throw new Error("gift orders can't be cancelled online");
  }
}
