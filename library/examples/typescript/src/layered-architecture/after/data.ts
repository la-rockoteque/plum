import type { DatabaseSync } from "node:sqlite";
import type { OrderRepository } from "./application.js";
import { Order, OrderStatus } from "./domain.js";

// Data-layer adapter for tests and demos: same contract, no database.
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

export function initializeSchema(database: DatabaseSync): void {
  database.exec(
    "CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY, status TEXT NOT NULL)",
  );
}

// Data-layer adapter over SQLite. Caller owns the database handle.
export class SqliteOrderRepository implements OrderRepository {
  constructor(private readonly database: DatabaseSync) {}

  get(orderId: number): Order | undefined {
    const row = this.database
      .prepare("SELECT id, status FROM orders WHERE id = ?")
      .get(orderId) as { id: number; status: OrderStatus } | undefined;
    return row ? new Order(row.id, row.status) : undefined;
  }

  save(order: Order): void {
    this.database.prepare(
      "INSERT INTO orders (id, status) VALUES (?, ?) " +
        "ON CONFLICT(id) DO UPDATE SET status = excluded.status",
    ).run(order.id, order.status);
  }
}
