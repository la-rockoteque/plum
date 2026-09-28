import type { OrderRepository } from "./order-repository.js";

export class OrderNotFound extends Error {}

export class CancelOrder {
  constructor(private readonly repository: OrderRepository) {}

  execute(orderId: number): void {
    const order = this.repository.get(orderId);
    if (!order) throw new OrderNotFound(`Order ${orderId} not found`);
    order.cancel();
    this.repository.save(order);
  }
}
