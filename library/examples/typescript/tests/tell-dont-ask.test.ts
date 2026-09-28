import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AdminCancelTool as AfterAdminCancelTool,
  ApiCancelHandler as AfterApiCancelHandler,
  Clock as AfterClock,
  NightlyCancelJob as AfterNightlyCancelJob,
  Order as AfterOrder,
  OrderStatus as AfterOrderStatus,
} from "../src/tell-dont-ask/after.js";
import {
  AdminCancelTool as BeforeAdminCancelTool,
  ApiCancelHandler as BeforeApiCancelHandler,
  Clock as BeforeClock,
  NightlyCancelJob as BeforeNightlyCancelJob,
  Order as BeforeOrder,
  OrderStatus as BeforeOrderStatus,
} from "../src/tell-dont-ask/before.js";

class FakeClock implements BeforeClock, AfterClock {
  constructor(private readonly ms: number) {}
  nowMs(): number {
    return this.ms;
  }
}

test("before: api handler cancels a pending order and sets the refund", () => {
  const order = new BeforeOrder(1, BeforeOrderStatus.Pending, 5000);
  new BeforeApiCancelHandler().cancel(order, new FakeClock(1000));
  assert.equal(order.status, BeforeOrderStatus.Cancelled);
  assert.equal(order.cancelledAtMs, 1000);
  assert.equal(order.refundDueCents, 5000);
});

test("before: nightly job cancels a stale order but leaves the refund unset", () => {
  const order = new BeforeOrder(2, BeforeOrderStatus.Pending, 5000);
  new BeforeNightlyCancelJob().cancel(order, new FakeClock(1000));
  assert.equal(order.status, BeforeOrderStatus.Cancelled);
  assert.equal(order.cancelledAtMs, 1000);
  assert.equal(order.refundDueCents, 0); // bug: the payment is gone, no refund recorded
});

test("before: admin tool cancels an already shipped order", () => {
  const order = new BeforeOrder(3, BeforeOrderStatus.Shipped, 5000, 500);
  new BeforeAdminCancelTool().cancel(order, new FakeClock(1000));
  assert.equal(order.status, BeforeOrderStatus.Cancelled); // bug: a shipped order should stay shipped
});

test("after: api handler nightly job and admin tool all cancel the same way", () => {
  const clock = new FakeClock(1000);
  const cases: Array<[{ cancel(order: AfterOrder, clock: AfterClock): void }, AfterOrder]> = [
    [new AfterApiCancelHandler(), new AfterOrder(1, AfterOrderStatus.Pending, 5000)],
    [new AfterNightlyCancelJob(), new AfterOrder(2, AfterOrderStatus.Pending, 5000)],
    [new AfterAdminCancelTool(), new AfterOrder(3, AfterOrderStatus.Pending, 5000)],
  ];
  for (const [handler, order] of cases) {
    handler.cancel(order, clock);
    assert.equal(order.status, AfterOrderStatus.Cancelled);
    assert.equal(order.cancelledAtMs, 1000);
    assert.equal(order.refundDueCents, 5000);
  }
});

test("after: cancelling an already shipped order is rejected", () => {
  const clock = new FakeClock(1000);
  const handlers: Array<{ cancel(order: AfterOrder, clock: AfterClock): void }> = [
    new AfterApiCancelHandler(),
    new AfterNightlyCancelJob(),
    new AfterAdminCancelTool(),
  ];
  for (const handler of handlers) {
    const order = new AfterOrder(4, AfterOrderStatus.Shipped, 5000, 500);
    assert.throws(() => handler.cancel(order, clock), Error);
    assert.equal(order.status, AfterOrderStatus.Shipped);
    assert.equal(order.cancelledAtMs, null);
    assert.equal(order.refundDueCents, 0);
  }
});
