import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { CancelOrder, OrderNotFound } from "../src/application/cancel-order.js";
import { Order, OrderAlreadyCancelled } from "../src/domain/order.js";
import { DrizzleOrderRepository, initializeSchema } from "../src/orm/repository.js";
import { cancelOrders } from "../src/uow/batch.js";

test("unit of work rolls back writes, propagates failures, and can be followed by a commit", () => {
  const connection = new Database(":memory:");
  try {
    initializeSchema(connection);
    const repository = new DrizzleOrderRepository(connection);
    repository.save(new Order(1));
    repository.save(new Order(2));
    const statuses = () => connection.prepare("SELECT status FROM orders ORDER BY id").pluck().all();
    assert.throws(() => cancelOrders(connection, [1, 404]), OrderNotFound);
    assert.deepEqual(statuses(), ["pending", "pending"]);
    assert.throws(() => cancelOrders(connection, [1, 1]), OrderAlreadyCancelled);
    assert.deepEqual(statuses(), ["pending", "pending"]);
    cancelOrders(connection, [1, 2]);
    assert.deepEqual(statuses(), ["cancelled", "cancelled"]);
    repository.save(new Order(1));
    assert.throws(() => {
      const cancel = new CancelOrder(repository);
      for (const id of [1, 404]) cancel.execute(id);
    }, OrderNotFound);
    assert.deepEqual(statuses(), ["cancelled", "cancelled"]);
  } finally {
    connection.close();
  }
});
