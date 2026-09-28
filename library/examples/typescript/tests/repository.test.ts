import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { CancelOrder as BeforeCancelOrder } from "../src/before-repository.js";
import type { OrderRepository } from "../src/application/order-repository.js";
import { Order, OrderStatus } from "../src/domain/order.js";
import { InMemoryOrderRepository } from "../src/infrastructure/in-memory-order-repository.js";
import { initializeSchema, SqliteOrderRepository } from "../src/infrastructure/sqlite-order-repository.js";

for (const adapter of ["memory", "sqlite"]) {
  test(`${adapter} meets the repository contract`, () => {
    const database = adapter === "sqlite" ? new DatabaseSync(":memory:") : undefined;
    try {
      let repository: OrderRepository;
      if (database) {
        initializeSchema(database);
        repository = new SqliteOrderRepository(database);
      } else {
        repository = new InMemoryOrderRepository();
      }
      assert.equal(repository.get(42), undefined);
      const original = new Order(1);
      repository.save(original);
      original.cancel();
      const loaded = repository.get(1);
      assert.deepEqual(loaded, new Order(1));
      assert.ok(loaded);
      loaded.cancel();
      assert.equal(repository.get(1)?.status, OrderStatus.Pending);
      repository.save(loaded);
      assert.equal(repository.get(1)?.status, OrderStatus.Cancelled);
    } finally {
      database?.close();
    }
  });
}

test("coupled example needs a database", () => {
  const database = new DatabaseSync(":memory:");
  try {
    initializeSchema(database);
    const repository = new SqliteOrderRepository(database);
    repository.save(new Order(1));
    const cancel = new BeforeCancelOrder(database);
    cancel.execute(1);
    assert.equal(repository.get(1)?.status, OrderStatus.Cancelled);
    assert.throws(() => cancel.execute(1), /already cancelled/);
    assert.throws(() => cancel.execute(42), /not found/);
    database.exec("UPDATE orders SET status = 'invalid' WHERE id = 1");
    assert.throws(() => repository.get(1), /Unknown order status/);
  } finally {
    database.close();
  }
});
