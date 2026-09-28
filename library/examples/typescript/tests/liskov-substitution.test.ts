import assert from "node:assert/strict";
import { test } from "node:test";
import { CancelExpiredOrders as AfterCancelExpiredOrders } from "../src/liskov-substitution/after/callers.js";
import { CustomerServiceCancelTool as AfterCustomerServiceCancelTool } from "../src/liskov-substitution/after/callers.js";
import {
  GiftOrder as AfterGiftOrder,
  StandardOrder,
  SubscriptionOrder,
} from "../src/liskov-substitution/after/order.js";
import type { CancellableOrder } from "../src/liskov-substitution/after/order.js";
import { CancelExpiredOrders as BeforeCancelExpiredOrders } from "../src/liskov-substitution/before/callers.js";
import { CustomerServiceCancelTool as BeforeCustomerServiceCancelTool } from "../src/liskov-substitution/before/callers.js";
import { GiftOrder as BeforeGiftOrder, Order as BeforeOrder } from "../src/liskov-substitution/before/order.js";

test("before: a pending order can be cancelled", () => {
  const order = new BeforeOrder(1, "Ada");
  order.cancel("customer requested");
  assert.equal(order.status, "cancelled");
});

test("before: a gift order rejects cancellation even while pending", () => {
  // The precondition GiftOrder accepts is stricter than Order's: Order allows
  // cancelling while pending, GiftOrder never does. That's the LSP violation.
  const gift = new BeforeGiftOrder(1, "Ada");
  assert.throws(() => gift.cancel("customer requested"), /gift orders can't be cancelled online/);
  assert.equal(gift.status, "pending");
});

test("before: the expired orders batch must skip gift orders to avoid the broken contract", () => {
  const batch = new BeforeCancelExpiredOrders();
  const standard = new BeforeOrder(1, "Ada");
  const gift = new BeforeGiftOrder(2, "Bob");
  const { cancelled, skipped } = batch.execute([standard, gift], "expired");
  assert.deepEqual(cancelled, [1]);
  assert.deepEqual(skipped, [2]);
  assert.equal(standard.status, "cancelled");
  assert.equal(gift.status, "pending");
});

test("before: the customer service tool must special case gift orders to avoid the broken contract", () => {
  const tool = new BeforeCustomerServiceCancelTool();
  const standard = new BeforeOrder(1, "Ada");
  const gift = new BeforeGiftOrder(2, "Bob");
  assert.equal(tool.cancel(standard, "changed my mind"), "order 1 cancelled: changed my mind");
  assert.equal(standard.status, "cancelled");
  assert.equal(
    tool.cancel(gift, "changed my mind"),
    "order 2 must be cancelled by phone: gift orders can't be cancelled online",
  );
  assert.equal(gift.status, "pending");
});

// The same contract body runs against every CancellableOrder subtype.
const cancellableFactories: Array<[string, () => CancellableOrder]> = [
  ["standard order", () => new StandardOrder(1)],
  ["subscription order", () => new SubscriptionOrder(1)],
];

for (const [name, makeOrder] of cancellableFactories) {
  test(`after: any cancellable order can be cancelled while pending (${name})`, () => {
    const order = makeOrder();
    order.cancel("customer requested");
    assert.equal(order.status, "cancelled");
  });

  test(`after: any cancellable order rejects cancelling an already cancelled order (${name})`, () => {
    const order = makeOrder();
    order.cancel("customer requested");
    assert.throws(() => order.cancel("customer requested"), /cannot cancel a shipped or cancelled order/);
  });
}

test("after: the expired orders batch cancels every cancellable order without checking its type", () => {
  const batch = new AfterCancelExpiredOrders();
  const standard = new StandardOrder(1);
  const subscription = new SubscriptionOrder(2);
  const cancelled = batch.execute([standard, subscription], "expired");
  assert.deepEqual(cancelled, [1, 2]);
  assert.equal(standard.status, "cancelled");
  assert.equal(subscription.status, "cancelled");
});

test("after: the customer service tool cancels any cancellable order without checking its type", () => {
  const tool = new AfterCustomerServiceCancelTool();
  const standard = new StandardOrder(1);
  const subscription = new SubscriptionOrder(2);
  assert.equal(tool.cancel(standard, "changed my mind"), "order 1 cancelled: changed my mind");
  assert.equal(tool.cancel(subscription, "changed my mind"), "order 2 cancelled: changed my mind");
});

test("after: a gift order does not satisfy the cancellable order contract", () => {
  const gift = new AfterGiftOrder(1);
  const standard = new StandardOrder(1);
  assert.equal("cancel" in gift, false);
  assert.equal("cancel" in standard, true);
});
