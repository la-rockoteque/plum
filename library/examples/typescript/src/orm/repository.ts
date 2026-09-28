import type Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { OrderRepository } from "../application/order-repository.js";
import { Order, OrderStatus } from "../domain/order.js";

export const orderRows = sqliteTable("orders", {
  id: integer("id").primaryKey(),
  status: text("status").notNull(),
});

export function initializeSchema(connection: Database.Database): void {
  // Bootstrap a fresh demo database. Real schema changes belong in migrations.
  connection.exec("CREATE TABLE orders (id INTEGER PRIMARY KEY, status TEXT NOT NULL)");
}

export class DrizzleOrderRepository implements OrderRepository {
  private readonly database: BetterSQLite3Database;

  constructor(connection: Database.Database, logSql = false) {
    this.database = drizzle(connection, { logger: logSql });
  }

  get(orderId: number): Order | undefined {
    const row = this.database.select().from(orderRows).where(eq(orderRows.id, orderId)).get();
    if (!row) return undefined;
    if (!Number.isSafeInteger(row.id)) throw new Error("Order ID must be a safe integer");
    if (row.status !== OrderStatus.Pending && row.status !== OrderStatus.Cancelled) {
      throw new Error(`Unknown order status: ${row.status}`);
    }
    return new Order(row.id, row.status);
  }

  save(order: Order): void {
    this.database.insert(orderRows).values({ id: order.id, status: order.status })
      .onConflictDoUpdate({ target: orderRows.id, set: { status: order.status } }).run();
  }
}
