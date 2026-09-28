import assert from "node:assert/strict";
import { test } from "node:test";
import { Order as AfterOrder, OrderStatus as AfterStatus } from "../src/yagni-kiss/after.js";
import {
  Order as BeforeOrder,
  OrderCancellationService,
  OrderStatus as BeforeStatus,
} from "../src/yagni-kiss/before.js";

const NOW_MS = 10_000_000;
const WINDOW_MS = 24 * 60 * 60 * 1000;

class FixedClock {
  constructor(private readonly ms: number) {}
  nowMs(): number {
    return this.ms;
  }
}

test("before: a fresh pending order can be cancelled", () => {
  const order = new BeforeOrder(1, BeforeStatus.Pending, NOW_MS);
  const clock = new FixedClock(NOW_MS);
  assert.equal(new OrderCancellationService().canCancel(order, clock), true);
});

test("before: an order past the cancellation window cannot be cancelled", () => {
  const order = new BeforeOrder(1, BeforeStatus.Pending, NOW_MS - WINDOW_MS * 2);
  const clock = new FixedClock(NOW_MS);
  assert.equal(new OrderCancellationService().canCancel(order, clock), false);
});

test("before: a shipped order cannot be cancelled", () => {
  const order = new BeforeOrder(1, BeforeStatus.Shipped, NOW_MS);
  const clock = new FixedClock(NOW_MS);
  assert.equal(new OrderCancellationService().canCancel(order, clock), false);
});

test("before: a typo in the policy config name silently falls back to the default policy", () => {
  const order = new BeforeOrder(1, BeforeStatus.Pending, NOW_MS);
  const clock = new FixedClock(NOW_MS);
  const correctlyNamed = new OrderCancellationService("standard");
  const typoNamed = new OrderCancellationService("stadnard");
  assert.equal(typoNamed.canCancel(order, clock), correctlyNamed.canCancel(order, clock));
});

test("before: the unused cancellation hooks are empty by default", () => {
  const service = new OrderCancellationService();
  assert.deepEqual(service.hooks.onBeforeCancel, []);
  assert.deepEqual(service.hooks.onAfterCancel, []);
});

test("after: a fresh pending order can be cancelled", () => {
  const order = new AfterOrder(1, AfterStatus.Pending, NOW_MS);
  const clock = new FixedClock(NOW_MS);
  assert.equal(order.canBeCancelled(clock), true);
});

test("after: an order past the cancellation window cannot be cancelled", () => {
  const order = new AfterOrder(1, AfterStatus.Pending, NOW_MS - WINDOW_MS * 2);
  const clock = new FixedClock(NOW_MS);
  assert.equal(order.canBeCancelled(clock), false);
});

test("after: a shipped order cannot be cancelled", () => {
  const order = new AfterOrder(1, AfterStatus.Shipped, NOW_MS);
  const clock = new FixedClock(NOW_MS);
  assert.equal(order.canBeCancelled(clock), false);
});
