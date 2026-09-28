import { DatabaseSync } from "node:sqlite";
import { CancelOrder } from "../application/cancel-order.js";
import type { OrderRepository } from "../application/order-repository.js";
import { Order } from "../domain/order.js";
import { InMemoryOrderRepository } from "../infrastructure/in-memory-order-repository.js";
import { initializeSchema, SqliteOrderRepository } from "../infrastructure/sqlite-order-repository.js";
import { OrderService } from "./before.js";
import { InMemoryOrderSummaryReader } from "./in-memory-reader.js";
import { GetOrderSummary, type OrderSummaryReader } from "./queries.js";
import { SqliteOrderSummaryReader } from "./sqlite-reader.js";

function demonstrate(repository: OrderRepository, reader: OrderSummaryReader): void {
  repository.save(new Order(1));
  const query = new GetOrderSummary(reader);
  const before = query.execute(1);
  new CancelOrder(repository).execute(1);
  const after = query.execute(1);
  console.log(`Before: ${before.status}, can_cancel=${before.canCancel}`);
  console.log(`After: ${after.status}, can_cancel=${after.canCancel}`);
}

const [mode, ...extra] = process.argv.slice(2);
switch (extra.length === 0 ? mode : undefined) {
  case "before": {
    const repository = new InMemoryOrderRepository();
    repository.save(new Order(1));
    const order = new OrderService(repository).cancelAndGet(1);
    console.log(`Order ${order.id}: ${order.status}`);
    break;
  }
  case "memory": {
    const repository = new InMemoryOrderRepository();
    demonstrate(repository, new InMemoryOrderSummaryReader(repository));
    break;
  }
  case "sqlite": {
    const database = new DatabaseSync(":memory:");
    try {
      initializeSchema(database);
      demonstrate(new SqliteOrderRepository(database), new SqliteOrderSummaryReader(database));
    } finally {
      database.close();
    }
    break;
  }
  default:
    console.error("Usage: npm run demo:cqrs -- before|memory|sqlite");
    process.exitCode = 1;
}
