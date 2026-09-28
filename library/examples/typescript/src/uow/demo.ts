import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { CancelOrder, OrderNotFound } from "../application/cancel-order.js";
import { Order } from "../domain/order.js";
import { DrizzleOrderRepository, initializeSchema } from "../orm/repository.js";
import { cancelOrders } from "./batch.js";

const connection = new Database(":memory:");
try {
  initializeSchema(connection);
  const repository = new DrizzleOrderRepository(connection);
  for (const mode of ["before", "rollback", "commit"]) {
    repository.save(new Order(1));
    repository.save(new Order(2));
    const ids = mode === "commit" ? [1, 2] : [1, 404];
    try {
      if (mode === "before") for (const id of ids) new CancelOrder(repository).execute(id);
      else cancelOrders(connection, ids);
    } catch (error) {
      if (!(error instanceof OrderNotFound) || mode === "commit") throw error;
    }
    const statuses = connection.prepare("SELECT status FROM orders ORDER BY id").pluck().all();
    assert.deepEqual(statuses, mode === "before" ? ["cancelled", "pending"] : mode === "rollback" ? ["pending", "pending"] : ["cancelled", "cancelled"]);
    console.log(`${mode}: ${statuses.join(", ")}`);
  }
} finally {
  connection.close();
}
