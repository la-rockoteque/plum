import type { Order } from "../domain/order.js";

// get returns a detached entity; save inserts or updates by ID.
export interface OrderRepository {
  get(orderId: number): Order | undefined;
  save(order: Order): void;
}
