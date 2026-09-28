import type { DatabaseSync } from "node:sqlite";
import type { OrderRepository } from "../application/order-repository.js";
import { Order, OrderStatus } from "../domain/order.js";

export function initializeSchema(database: DatabaseSync): void {
  database.exec(
    "CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY, status TEXT NOT NULL)",
  );
}

// Caller owns the database. Each write is one autocommitted statement.
export class SqliteOrderRepository implements OrderRepository {
  constructor(private readonly database: DatabaseSync) {}

  get(orderId: number): Order | undefined {
    const row = this.database
      .prepare("SELECT id, status FROM orders WHERE id = ?")
      .get(orderId) as { id: unknown; status: unknown } | undefined;
    if (!row) return undefined;
    if (typeof row.id !== "number" || !Number.isSafeInteger(row.id)) {
      throw new Error("Order ID must be a safe integer");
    }
    if (row.status !== OrderStatus.Pending && row.status !== OrderStatus.Cancelled) {
      throw new Error(`Unknown order status: ${row.status}`);
    }
    return new Order(row.id, row.status);
  }

  save(order: Order): void {
    this.database.prepare(
      "INSERT INTO orders (id, status) VALUES (?, ?) " +
        "ON CONFLICT(id) DO UPDATE SET status = excluded.status",
    ).run(order.id, order.status);
  }
}
