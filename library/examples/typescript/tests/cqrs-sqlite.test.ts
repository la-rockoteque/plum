import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { CancelOrder, OrderNotFound } from "../src/application/cancel-order.js";
import { GetOrderSummary } from "../src/cqrs/queries.js";
import { SqliteOrderSummaryReader } from "../src/cqrs/sqlite-reader.js";
import { Order } from "../src/domain/order.js";
import { initializeSchema, SqliteOrderRepository } from "../src/infrastructure/sqlite-order-repository.js";

test("read and write models share one SQLite database", () => {
  const database = new DatabaseSync(":memory:");
  try {
    initializeSchema(database);
    const repository = new SqliteOrderRepository(database);
    const reader = new SqliteOrderSummaryReader(database);
    const query = new GetOrderSummary(reader);
    assert.equal(reader.getSummary(42), undefined);
    assert.throws(() => query.execute(42), OrderNotFound);
    repository.save(new Order(1));
    const before = query.execute(1);
    assert.deepEqual(before, { id: 1, status: "pending", canCancel: true });
    assert.deepEqual(repository.get(1), new Order(1));
    new CancelOrder(repository).execute(1);
    assert.deepEqual(query.execute(1), { id: 1, status: "cancelled", canCancel: false });
    assert.deepEqual(before, { id: 1, status: "pending", canCancel: true });
  } finally {
    database.close();
  }
});
