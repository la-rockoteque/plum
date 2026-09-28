import assert from "node:assert/strict";
import test from "node:test";
import { Order as BeforeOrder, OrderLine, OrderLineRepository, recomputeTotal } from "../src/aggregates/before.js";
import {
  InvalidQuantityError,
  Order,
  OrderCancelledError,
  OrderRepository,
  TooManyLinesError,
} from "../src/aggregates/after.js";

test("before: adding a line does not update the cached total", () => {
  const order = new BeforeOrder(1);
  const repo = new OrderLineRepository();
  repo.add(new OrderLine(1, 1, "WIDGET", 2, 500, "USD"));
  assert.equal(order.totalMinor, 0);
});

test("before: an eleventh line is accepted", () => {
  const repo = new OrderLineRepository();
  for (let i = 0; i < 11; i++) {
    repo.add(new OrderLine(i, 1, `SKU-${i}`, 1, 100, "USD"));
  }
  assert.equal(repo.forOrder(1).length, 11);
});

test("before: a line's quantity can be set to zero", () => {
  const repo = new OrderLineRepository();
  repo.add(new OrderLine(1, 1, "WIDGET", 2, 500, "USD"));
  repo.updateQuantity(1, 0);
  assert.equal(repo.forOrder(1)[0].quantity, 0);
});

test("before: a cancelled order's line can still be changed", () => {
  const order = new BeforeOrder(1, "cancelled");
  const repo = new OrderLineRepository();
  repo.add(new OrderLine(1, 1, "WIDGET", 2, 500, "USD"));
  repo.updateQuantity(1, 5);
  assert.equal(order.status, "cancelled");
  assert.equal(repo.forOrder(1)[0].quantity, 5);
});

test("before: a line fetched from the repository can be mutated directly", () => {
  const repo = new OrderLineRepository();
  repo.add(new OrderLine(1, 1, "WIDGET", 2, 500, "USD"));
  const fetched = repo.forOrder(1)[0];
  fetched.quantity = 99;
  assert.equal(repo.forOrder(1)[0].quantity, 99);
});

test("before: recomputeTotal must be called manually to stay correct", () => {
  const order = new BeforeOrder(1);
  const repo = new OrderLineRepository();
  repo.add(new OrderLine(1, 1, "WIDGET", 2, 500, "USD"));
  recomputeTotal(order, repo.forOrder(1));
  assert.equal(order.totalMinor, 1000);
  repo.updateQuantity(1, 5);
  assert.equal(order.totalMinor, 1000);
});

test("after: adding a line updates the total immediately", () => {
  const order = new Order(1);
  order.addLine("WIDGET", 2, 500);
  assert.equal(order.totalMinor, 1000);
});

test("after: an eleventh line is rejected", () => {
  const order = new Order(1);
  for (let i = 0; i < 10; i++) {
    order.addLine(`SKU-${i}`, 1, 100);
  }
  assert.throws(() => order.addLine("SKU-10", 1, 100), TooManyLinesError);
});

test("after: changing a line's quantity to zero is rejected", () => {
  const order = new Order(1);
  const lineId = order.addLine("WIDGET", 2, 500);
  assert.throws(() => order.changeQuantity(lineId, 0), InvalidQuantityError);
});

test("after: changing a line on a cancelled order is rejected", () => {
  const order = new Order(1);
  const lineId = order.addLine("WIDGET", 2, 500);
  order.cancel();
  assert.throws(() => order.changeQuantity(lineId, 3), OrderCancelledError);
});

test("after: the lines returned by the order are copies that cannot mutate it", () => {
  const order = new Order(1);
  order.addLine("WIDGET", 2, 500);
  const fetched = order.lines[0];
  fetched.quantity = 99;
  assert.equal(order.lines[0].quantity, 2);
  assert.equal(order.totalMinor, 1000);
});

test("after: the repository saves and loads the whole order", () => {
  const order = new Order(1);
  order.addLine("WIDGET", 2, 500);
  const repo = new OrderRepository();
  repo.save(order);

  const loaded = repo.get(1);
  assert.ok(loaded);
  assert.equal(loaded.totalMinor, 1000);
  assert.equal(loaded.lines.length, 1);
});
