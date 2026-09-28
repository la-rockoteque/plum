export enum OrderStatus {
  Pending = "pending",
  Cancelled = "cancelled",
}

export class OrderAlreadyCancelled extends Error {}

export class Order {
  constructor(
    readonly id: number,
    public status: OrderStatus = OrderStatus.Pending,
  ) {}

  cancel(): void {
    if (this.status === OrderStatus.Cancelled) {
      throw new OrderAlreadyCancelled(`Order ${this.id} already cancelled`);
    }
    this.status = OrderStatus.Cancelled;
  }
}
