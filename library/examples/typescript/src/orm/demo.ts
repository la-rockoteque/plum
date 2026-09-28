import Database from "better-sqlite3";
import { DatabaseSync } from "node:sqlite";
import { CancelOrder } from "../application/cancel-order.js";
import type { OrderRepository } from "../application/order-repository.js";
import { Order } from "../domain/order.js";
import { initializeSchema as initializeRawSchema, SqliteOrderRepository } from "../infrastructure/sqlite-order-repository.js";
import { DrizzleOrderRepository, initializeSchema } from "./repository.js";

function demonstrate(repository: OrderRepository): void {
  repository.save(new Order(1));
  new CancelOrder(repository).execute(1);
  const order = repository.get(1);
  if (!order) throw new Error("Order disappeared");
  console.log(`Order ${order.id}: ${order.status}`);
}

const [mode, ...extra] = process.argv.slice(2);
if (extra.length === 0 && mode === "raw") {
  const connection = new DatabaseSync(":memory:");
  try {
    initializeRawSchema(connection);
    demonstrate(new SqliteOrderRepository(connection));
  } finally {
    connection.close();
  }
} else if (extra.length === 0 && (mode === "orm" || mode === "sql")) {
  const connection = new Database(":memory:");
  try {
    initializeSchema(connection);
    demonstrate(new DrizzleOrderRepository(connection, mode === "sql"));
  } finally {
    connection.close();
  }
} else {
  console.error("Usage: npm run demo:orm -- raw|orm|sql");
  process.exitCode = 1;
}
