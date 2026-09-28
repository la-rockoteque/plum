import type { OrderRepository } from "../application/order-repository.js";
import { Order } from "../domain/order.js";

export class InMemoryOrderRepository implements OrderRepository {
  private readonly orders = new Map<number, Order>();

  get(orderId: number): Order | undefined {
    const order = this.orders.get(orderId);
    return order ? new Order(order.id, order.status) : undefined;
  }

  save(order: Order): void {
    this.orders.set(order.id, new Order(order.id, order.status));
  }
}
