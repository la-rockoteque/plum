import { OrderNotFound } from "../application/cancel-order.js";
import type { OrderRepository } from "../application/order-repository.js";
import type { Order } from "../domain/order.js";

export class OrderService {
  constructor(private readonly repository: OrderRepository) {}

  cancelAndGet(orderId: number): Order {
    // One operation changes state and returns the write model to the caller.
    const order = this.repository.get(orderId);
    if (!order) throw new OrderNotFound(`Order ${orderId} not found`);
    order.cancel();
    this.repository.save(order);
    return order;
  }
}
