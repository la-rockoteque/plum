import { DatabaseSync } from "node:sqlite";
import { CancelOrder } from "./application/cancel-order.js";
import type { OrderRepository } from "./application/order-repository.js";
import { Order, OrderStatus } from "./domain/order.js";
import { InMemoryOrderRepository } from "./infrastructure/in-memory-order-repository.js";
import { initializeSchema, SqliteOrderRepository } from "./infrastructure/sqlite-order-repository.js";

function demonstrate(repository: OrderRepository): void {
  repository.save(new Order(1));
  new CancelOrder(repository).execute(1);
  const order = repository.get(1);
  if (order?.status !== OrderStatus.Cancelled) throw new Error("Cancel failed");
  console.log(`Order ${order.id}: ${order.status}`);
}

// Composition root: only construction changes when selecting an adapter.
const [adapter, ...extra] = process.argv.slice(2);
if (extra.length === 0 && adapter === "memory") {
  demonstrate(new InMemoryOrderRepository());
} else if (extra.length === 0 && adapter === "sqlite") {
  const database = new DatabaseSync(":memory:");
  try {
    initializeSchema(database);
    demonstrate(new SqliteOrderRepository(database));
  } finally {
    database.close();
  }
} else {
  console.error("Usage: npm run demo -- memory|sqlite");
  process.exitCode = 1;
}
