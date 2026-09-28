// before: switch (order.type) duplicated across the fee calculator and the
// refund description → after: one FeePolicy per type, chosen once through a map.
import assert from "node:assert/strict";
import { test } from "node:test";
import { CancellationFeeCalculator as AfterCalculator } from "../src/open-closed/after/cancellation-fee-calculator.js";
import { DEFAULT_POLICIES, FeePolicy } from "../src/open-closed/after/fee-policy.js";
import {
  CUSTOM_MADE as AFTER_CUSTOM_MADE,
  EXPRESS as AFTER_EXPRESS,
  Order as AfterOrder,
  STANDARD as AFTER_STANDARD,
  SUBSCRIPTION as AFTER_SUBSCRIPTION,
} from "../src/open-closed/after/order.js";
import { CancellationFeeCalculator as BeforeCalculator } from "../src/open-closed/before/fee-calculator.js";
import { CUSTOM_MADE, EXPRESS, Order as BeforeOrder, STANDARD, SUBSCRIPTION } from "../src/open-closed/before/order.js";
import { RefundDescription } from "../src/open-closed/before/refund-description.js";

function order(type: string, overrides: Partial<BeforeOrder> = {}): BeforeOrder {
  return { type, amount: 100.0, pending: true, monthsElapsed: 0, totalMonths: 1, ...overrides };
}

test("before: fee for a pending standard order is free", () => {
  assert.equal(new BeforeCalculator().calculateFee(order(STANDARD, { pending: true })), 0.0);
});

test("before: fee for a shipped standard order is the full amount", () => {
  assert.equal(new BeforeCalculator().calculateFee(order(STANDARD, { pending: false, amount: 100.0 })), 100.0);
});

test("before: fee and description for an express order", () => {
  const o = order(EXPRESS);
  assert.equal(new BeforeCalculator().calculateFee(o), 15.0);
  assert.match(new RefundDescription().describe(o), /express handling fee/);
});

test("before: fee for a subscription order is prorated by elapsed months", () => {
  const o = order(SUBSCRIPTION, { amount: 120.0, monthsElapsed: 3, totalMonths: 12 });
  assert.equal(new BeforeCalculator().calculateFee(o), 30.0);
});

test("before: a custom-made order gets the wrong refund description despite the right fee", () => {
  const o = order(CUSTOM_MADE, { amount: 200.0 });
  assert.equal(new BeforeCalculator().calculateFee(o), 100.0);
  assert.equal(new RefundDescription().describe(o), "Refund processed");
});

test("after: fee for a pending standard order is free", () => {
  const o: AfterOrder = { type: AFTER_STANDARD, amount: 100.0, pending: true, monthsElapsed: 0, totalMonths: 1 };
  assert.equal(new AfterCalculator().calculateFee(o), 0.0);
});

test("after: fee for a shipped standard order is the full amount", () => {
  const o: AfterOrder = { type: AFTER_STANDARD, amount: 100.0, pending: false, monthsElapsed: 0, totalMonths: 1 };
  assert.equal(new AfterCalculator().calculateFee(o), 100.0);
});

test("after: fee and description for an express order", () => {
  const o: AfterOrder = { type: AFTER_EXPRESS, amount: 100.0, pending: true, monthsElapsed: 0, totalMonths: 1 };
  const calculator = new AfterCalculator();
  assert.equal(calculator.calculateFee(o), 15.0);
  assert.match(calculator.describeRefund(o), /express handling fee/);
});

test("after: fee for a subscription order is prorated by elapsed months", () => {
  const o: AfterOrder = { type: AFTER_SUBSCRIPTION, amount: 120.0, pending: true, monthsElapsed: 3, totalMonths: 12 };
  assert.equal(new AfterCalculator().calculateFee(o), 30.0);
});

test("after: a custom-made order gets its own refund description", () => {
  const o: AfterOrder = { type: AFTER_CUSTOM_MADE, amount: 200.0, pending: true, monthsElapsed: 0, totalMonths: 1 };
  const calculator = new AfterCalculator();
  assert.equal(calculator.calculateFee(o), 100.0);
  assert.equal(calculator.describeRefund(o), "50% refund, materials already committed");
});

// A brand-new order type; no existing policy or calculator file is touched to add it.
class GiftFeePolicy implements FeePolicy {
  fee(_order: AfterOrder): number {
    return 0.0;
  }
  describeRefund(_order: AfterOrder): string {
    return "Full refund, gift orders are always free to cancel";
  }
}

test("after: adding a gift policy needs no change to existing policies", () => {
  const policies: Record<string, FeePolicy> = { ...DEFAULT_POLICIES, gift: new GiftFeePolicy() };
  const calculator = new AfterCalculator(policies);
  const o: AfterOrder = { type: "gift", amount: 50.0, pending: true, monthsElapsed: 0, totalMonths: 1 };
  assert.equal(calculator.calculateFee(o), 0.0);
  assert.equal(calculator.describeRefund(o), "Full refund, gift orders are always free to cancel");
});
