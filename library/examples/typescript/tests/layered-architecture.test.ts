import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import {
  CancelOrder,
  OrderNotFound,
} from "../src/layered-architecture/after/application.js";
import {
  InMemoryOrderRepository,
  SqliteOrderRepository,
  initializeSchema,
} from "../src/layered-architecture/after/data.js";
import { Order, OrderCannotBeCancelled, OrderStatus } from "../src/layered-architecture/after/domain.js";
import type { CancelOrderUseCase } from "../src/layered-architecture/after/presentation.js";
import { handleCancelRequest } from "../src/layered-architecture/after/presentation.js";
import { handleCancelRequest as beforeHandleCancelRequest } from "../src/layered-architecture/before.js";

test("before: proving the cancellation rule requires a request and a database", () => {
  const database = new DatabaseSync(":memory:");
  try {
    database.exec("CREATE TABLE orders (id INTEGER PRIMARY KEY, status TEXT)");
    database.exec("INSERT INTO orders VALUES (1, 'pending'), (2, 'shipped')");

    assert.deepEqual(beforeHandleCancelRequest({ orderId: "1" }, database), {
      status: "ok",
      message: "order 1 cancelled",
    });
    assert.equal(
      (database.prepare("SELECT status FROM orders WHERE id = 1").get() as { status: string })
        .status,
      "cancelled",
    );

    // Proving the rule (a shipped order can't be cancelled) needs this same database.
    assert.equal(beforeHandleCancelRequest({ orderId: "2" }, database).status, "rejected");
    assert.equal(beforeHandleCancelRequest({ orderId: "1" }, database).status, "rejected");
    assert.equal(beforeHandleCancelRequest({ orderId: "42" }, database).status, "not_found");
    assert.equal(beforeHandleCancelRequest({ orderId: "nope" }, database).status, "invalid");
  } finally {
    database.close();
  }
});

for (const status of [OrderStatus.Shipped, OrderStatus.Cancelled]) {
  test(`after: the domain rule rejects a ${status} order with no request or database`, () => {
    assert.throws(() => new Order(1, status).cancel(), OrderCannotBeCancelled);
  });
}

test("after: the domain rule cancels a pending order", () => {
  const order = new Order(1);
  order.cancel();
  assert.equal(order.status, OrderStatus.Cancelled);
});

test("after: the application service cancels through an in-memory repository", () => {
  const repository = new InMemoryOrderRepository();
  repository.save(new Order(1));
  new CancelOrder(repository).execute(1);
  assert.equal(repository.get(1)?.status, OrderStatus.Cancelled);

  assert.throws(() => new CancelOrder(repository).execute(42), OrderNotFound);

  repository.save(new Order(2, OrderStatus.Shipped));
  assert.throws(() => new CancelOrder(repository).execute(2), OrderCannotBeCancelled);
});

test("after: the handler cancels through a fake application service", () => {
  class FakeCancelOrder implements CancelOrderUseCase {
    calledWith: number | undefined;
    constructor(private readonly error?: Error) {}
    execute(orderId: number): void {
      this.calledWith = orderId;
      if (this.error) throw this.error;
    }
  }

  const useCase = new FakeCancelOrder();
  assert.deepEqual(handleCancelRequest({ orderId: "1" }, useCase), {
    status: "ok",
    message: "order 1 cancelled",
  });
  assert.equal(useCase.calledWith, 1);

  assert.equal(handleCancelRequest({ orderId: "nope" }, new FakeCancelOrder()).status, "invalid");
  assert.equal(
    handleCancelRequest({ orderId: "1" }, new FakeCancelOrder(new OrderNotFound())).status,
    "not_found",
  );
  assert.equal(
    handleCancelRequest({ orderId: "1" }, new FakeCancelOrder(new OrderCannotBeCancelled())).status,
    "rejected",
  );
});

test("after: presentation, application, domain and data cancel an order on sqlite", () => {
  const database = new DatabaseSync(":memory:");
  try {
    initializeSchema(database);
    const repository = new SqliteOrderRepository(database);
    repository.save(new Order(1));
    repository.save(new Order(2, OrderStatus.Shipped));

    const useCase = new CancelOrder(repository);
    assert.deepEqual(handleCancelRequest({ orderId: "1" }, useCase), {
      status: "ok",
      message: "order 1 cancelled",
    });
    assert.equal(repository.get(1)?.status, OrderStatus.Cancelled);
    assert.equal(handleCancelRequest({ orderId: "2" }, useCase).status, "rejected");
    assert.equal(handleCancelRequest({ orderId: "42" }, useCase).status, "not_found");
    assert.equal(handleCancelRequest({ orderId: "nope" }, useCase).status, "invalid");
  } finally {
    database.close();
  }
});
