export enum OrderStatus {
  Pending = "pending",
  Shipped = "shipped",
  Cancelled = "cancelled",
}

export class OrderCannotBeCancelled extends Error {}

export class Order {
  constructor(
    readonly id: number,
    public status: OrderStatus = OrderStatus.Pending,
  ) {}

  cancel(): void {
    if (this.status === OrderStatus.Shipped || this.status === OrderStatus.Cancelled) {
      throw new OrderCannotBeCancelled(`order ${this.id} already ${this.status}`);
    }
    this.status = OrderStatus.Cancelled;
  }
}
