import type Database from "better-sqlite3";
import { CancelOrder } from "../application/cancel-order.js";
import { DrizzleOrderRepository } from "../orm/repository.js";

export function cancelOrders(connection: Database.Database, orderIds: number[]): void {
  // Every repository statement uses this connection and its outer transaction.
  connection.transaction(() => {
    const cancel = new CancelOrder(new DrizzleOrderRepository(connection));
    for (const id of orderIds) cancel.execute(id);
  })(); // Commits on return; rolls back and rethrows on failure. Keep this synchronous.
}
