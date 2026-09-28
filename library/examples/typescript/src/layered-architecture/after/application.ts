import type { Order } from "./domain.js";

// Port owned by the application layer. Data adapters implement it.
export interface OrderRepository {
  get(orderId: number): Order | undefined;
  save(order: Order): void;
}

export class OrderNotFound extends Error {}

// Application service: loads the aggregate, calls domain behaviour, saves it.
export class CancelOrder {
  constructor(private readonly repository: OrderRepository) {}

  execute(orderId: number): void {
    const order = this.repository.get(orderId);
    if (!order) throw new OrderNotFound(`order ${orderId} not found`);
    order.cancel();
    this.repository.save(order);
  }
}
