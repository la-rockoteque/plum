import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ApiCancelHandler as AfterApi,
  CliCancelHandler as AfterCli,
  Order as AfterOrder,
  OrderStatus as AfterStatus,
} from "../src/dry/after.js";
import {
  ApiCancelHandler as BeforeApi,
  CliCancelHandler as BeforeCli,
  Order as BeforeOrder,
  OrderStatus as BeforeStatus,
} from "../src/dry/before.js";

const NOW_MS = 10_000_000;
const WINDOW_MS = 24 * 60 * 60 * 1000;

class FixedClock {
  constructor(private readonly ms: number) {}
  nowMs(): number {
    return this.ms;
  }
}

test("before: cli and api agree a fresh pending order can be cancelled", () => {
  const order = new BeforeOrder(1, BeforeStatus.Pending, NOW_MS);
  const clock = new FixedClock(NOW_MS);
  assert.equal(new BeforeCli().canCancel(order, clock), true);
  assert.equal(new BeforeApi().canCancel(order, clock), true);
});

test("before: cli and api disagree once the cancellation window has passed", () => {
  const order = new BeforeOrder(1, BeforeStatus.Pending, NOW_MS - WINDOW_MS * 2);
  const clock = new FixedClock(NOW_MS);
  assert.equal(new BeforeCli().canCancel(order, clock), false);
  assert.equal(new BeforeApi().canCancel(order, clock), true);
});

test("before: neither handler allows cancelling a shipped order", () => {
  const order = new BeforeOrder(1, BeforeStatus.Shipped, NOW_MS);
  const clock = new FixedClock(NOW_MS);
  assert.equal(new BeforeCli().canCancel(order, clock), false);
  assert.equal(new BeforeApi().canCancel(order, clock), false);
});

test("after: cli and api agree a fresh pending order can be cancelled", () => {
  const order = new AfterOrder(1, AfterStatus.Pending, NOW_MS);
  const clock = new FixedClock(NOW_MS);
  assert.equal(new AfterCli().canCancel(order, clock), true);
  assert.equal(new AfterApi().canCancel(order, clock), true);
});

test("after: cli and api agree once the cancellation window has passed", () => {
  const order = new AfterOrder(1, AfterStatus.Pending, NOW_MS - WINDOW_MS * 2);
  const clock = new FixedClock(NOW_MS);
  assert.equal(new AfterCli().canCancel(order, clock), false);
  assert.equal(new AfterApi().canCancel(order, clock), false);
});

test("after: neither handler allows cancelling a shipped order", () => {
  const order = new AfterOrder(1, AfterStatus.Shipped, NOW_MS);
  const clock = new FixedClock(NOW_MS);
  assert.equal(new AfterCli().canCancel(order, clock), false);
  assert.equal(new AfterApi().canCancel(order, clock), false);
});
