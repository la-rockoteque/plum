import assert from "node:assert/strict";
import { test } from "node:test";
import Database from "better-sqlite3";
import { CancelOrder, OrderNotFound } from "../src/application/cancel-order.js";
import { Order, OrderAlreadyCancelled, OrderStatus } from "../src/domain/order.js";
import { DrizzleOrderRepository, initializeSchema } from "../src/orm/repository.js";

test("Drizzle keeps the repository contract", () => {
  const connection = new Database(":memory:");
  try {
    initializeSchema(connection);
    const repository = new DrizzleOrderRepository(connection);
    assert.equal(repository.get(42), undefined);
    assert.throws(() => new CancelOrder(repository).execute(42), OrderNotFound);
    const original = new Order(1);
    repository.save(original);
    original.cancel();
    const loaded = repository.get(1);
    assert.deepEqual(loaded, new Order(1));
    assert.ok(loaded);
    loaded.cancel();
    assert.deepEqual(repository.get(1), new Order(1));
    new CancelOrder(repository).execute(1);
    assert.deepEqual(repository.get(1), new Order(1, OrderStatus.Cancelled));
    assert.throws(() => new CancelOrder(repository).execute(1), OrderAlreadyCancelled);
    assert.deepEqual(connection.prepare("SELECT id, status FROM orders").all(), [
      { id: 1, status: "cancelled" },
    ]);
    connection.exec("UPDATE orders SET status = 'invalid' WHERE id = 1");
    assert.throws(() => repository.get(1), /Unknown order status/);
  } finally {
    connection.close();
  }
});
