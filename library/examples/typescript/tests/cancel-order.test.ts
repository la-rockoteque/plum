import assert from "node:assert/strict";
import { test } from "node:test";
import { CancelOrder, OrderNotFound } from "../src/application/cancel-order.js";
import { Order, OrderAlreadyCancelled, OrderStatus } from "../src/domain/order.js";
import { InMemoryOrderRepository } from "../src/infrastructure/in-memory-order-repository.js";

test("cancels a pending order", () => {
  const repository = new InMemoryOrderRepository();
  repository.save(new Order(1));
  new CancelOrder(repository).execute(1);
  assert.equal(repository.get(1)?.status, OrderStatus.Cancelled);
});

test("rejects an unknown order", () => {
  const repository = new InMemoryOrderRepository();
  assert.throws(() => new CancelOrder(repository).execute(1), OrderNotFound);
  assert.equal(repository.get(1), undefined);
});

test("rejects a repeated cancellation", () => {
  const repository = new InMemoryOrderRepository();
  repository.save(new Order(1, OrderStatus.Cancelled));
  assert.throws(() => new CancelOrder(repository).execute(1), OrderAlreadyCancelled);
  assert.equal(repository.get(1)?.status, OrderStatus.Cancelled);
});
