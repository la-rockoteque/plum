import assert from "node:assert/strict";
import { test } from "node:test";
import { CancelOrder, OrderNotFound } from "../src/application/cancel-order.js";
import { OrderService } from "../src/cqrs/before.js";
import { InMemoryOrderSummaryReader } from "../src/cqrs/in-memory-reader.js";
import { GetOrderSummary } from "../src/cqrs/queries.js";
import { Order, OrderAlreadyCancelled, OrderStatus } from "../src/domain/order.js";
import { InMemoryOrderRepository } from "../src/infrastructure/in-memory-order-repository.js";

test("queries are snapshots and commands keep domain rules", () => {
  const repository = new InMemoryOrderRepository();
  repository.save(new Order(1));
  const query = new GetOrderSummary(new InMemoryOrderSummaryReader(repository));
  const before = query.execute(1);
  assert.deepEqual(before, { id: 1, status: "pending", canCancel: true });
  assert.deepEqual(repository.get(1), new Order(1));
  new CancelOrder(repository).execute(1);
  assert.deepEqual(query.execute(1), { id: 1, status: "cancelled", canCancel: false });
  assert.deepEqual(before, { id: 1, status: "pending", canCancel: true });
  assert.throws(() => new CancelOrder(repository).execute(1), OrderAlreadyCancelled);
  assert.equal(query.execute(1).canCancel, false);
});

test("unknown query does not create an order", () => {
  const repository = new InMemoryOrderRepository();
  const reader = new InMemoryOrderSummaryReader(repository);
  assert.equal(reader.getSummary(42), undefined);
  assert.throws(() => new GetOrderSummary(reader).execute(42), OrderNotFound);
  assert.equal(repository.get(42), undefined);
});

test("before returns the write model", () => {
  const repository = new InMemoryOrderRepository();
  repository.save(new Order(1));
  const service = new OrderService(repository);
  const order = service.cancelAndGet(1);
  assert.ok(order instanceof Order);
  assert.equal(repository.get(1)?.status, OrderStatus.Cancelled);
  assert.throws(() => service.cancelAndGet(1), OrderAlreadyCancelled);
  assert.throws(() => service.cancelAndGet(42), OrderNotFound);
});
