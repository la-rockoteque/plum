import { OrderStatus } from "../domain/order.js";
import type { InMemoryOrderRepository } from "../infrastructure/in-memory-order-repository.js";
import type { OrderSummary, OrderSummaryReader } from "./queries.js";

export class InMemoryOrderSummaryReader implements OrderSummaryReader {
  constructor(private readonly repository: InMemoryOrderRepository) {}

  getSummary(orderId: number): OrderSummary | undefined {
    const order = this.repository.get(orderId);
    return order ? {
      id: order.id, status: order.status, canCancel: order.status === OrderStatus.Pending,
    } : undefined;
  }
}
