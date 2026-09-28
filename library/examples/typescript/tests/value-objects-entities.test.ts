import assert from "node:assert/strict";
import test from "node:test";
import { Order as BeforeOrder, addTotals } from "../src/value-objects-entities/before.js";
import {
  CurrencyMismatch,
  InvalidStatusTransition,
  Money,
  Order,
  OrderStatus,
} from "../src/value-objects-entities/after.js";

test("before: an invalid status string is accepted", () => {
  const order = new BeforeOrder(1, "pending", 9.99, "USD");
  order.status = "definitely-not-a-status";
  assert.equal(order.status, "definitely-not-a-status");
});

test("before: a cancelled order can be moved back to pending", () => {
  const order = new BeforeOrder(1, "cancelled", 9.99, "USD");
  order.status = "pending";
  assert.equal(order.status, "pending");
});

test("before: totals in different currencies are added together", () => {
  const usdOrder = new BeforeOrder(1, "pending", 10.0, "USD");
  const eurOrder = new BeforeOrder(2, "pending", 5.0, "EUR");
  assert.equal(addTotals(usdOrder, eurOrder), 15.0);
});

test("before: repeated float amounts drift from the exact total", () => {
  const orders = [0, 1, 2].map((id) => new BeforeOrder(id, "pending", 0.1, "USD"));
  const total = addTotals(orders[0], orders[1]) + orders[2].total;
  assert.notEqual(total, 0.3);
});

test("after: constructing an order with an unknown status is rejected", () => {
  assert.throws(() => OrderStatus.parse("definitely-not-a-status"), InvalidStatusTransition);
});

test("after: cancelling a cancelled order is rejected", () => {
  const order = new Order(1, OrderStatus.Pending, new Money(999, "USD"));
  order.cancel();
  assert.throws(() => order.cancel(), InvalidStatusTransition);
});

test("after: a cancelled order cannot move back to pending", () => {
  const order = new Order(1, OrderStatus.Pending, new Money(999, "USD"));
  order.cancel();
  assert.throws(() => order.status.transitionTo(OrderStatus.Pending), InvalidStatusTransition);
});

test("after: adding money in different currencies is rejected", () => {
  assert.throws(() => new Money(1000, "USD").add(new Money(500, "EUR")), CurrencyMismatch);
});

test("after: repeated money amounts do not drift", () => {
  const total = new Money(10, "USD").add(new Money(10, "USD")).add(new Money(10, "USD"));
  assert.ok(total.equals(new Money(30, "USD")));
});

test("after: money with equal amount and currency is equal by value", () => {
  assert.ok(new Money(1000, "USD").equals(new Money(1000, "USD")));
  assert.ok(!new Money(1000, "USD").equals(new Money(1000, "EUR")));
});

test("after: money is immutable", () => {
  const a = new Money(1000, "USD");
  const b = new Money(500, "USD");
  const c = a.add(b);
  assert.ok(a.equals(new Money(1000, "USD")));
  assert.ok(c.equals(new Money(1500, "USD")));
  assert.notEqual(c, a);
});

test("after: two orders with equal fields but different ids are not equal", () => {
  const total = new Money(500, "USD");
  const orderA = new Order(1, OrderStatus.Pending, total);
  const orderB = new Order(2, OrderStatus.Pending, total);
  assert.ok(!orderA.equals(orderB));

  const orderC = new Order(1, OrderStatus.Pending, total);
  orderC.cancel();
  assert.ok(orderA.equals(orderC));
});
