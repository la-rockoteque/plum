import assert from "node:assert/strict";
import { test } from "node:test";
import { Order as LegacyOrder, computeRefund as legacyComputeRefund } from "../src/characterization-tests/legacy.js";
import { Order as RefactoredOrder, computeRefund as refactoredComputeRefund } from "../src/characterization-tests/refactored.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const TODAY_MS = 1_700_000_000_000;

test("before: nobody knows what computeRefund does for most inputs", () => {
  // The starting point of legacy work: one sample input pinned, nothing more understood yet.
  const order: LegacyOrder = { orderId: 1, amountMinor: 10_000, purchasedAtMs: TODAY_MS - 5 * MS_PER_DAY, status: "active" };
  assert.equal(legacyComputeRefund(order, TODAY_MS), 10_000);
});

test("currently a hold order refunds zero regardless of age", () => {
  const fields = { amountMinor: 10_000, purchasedAtMs: TODAY_MS - 5 * MS_PER_DAY, status: "hold" };
  assert.equal(legacyComputeRefund({ orderId: 2, ...fields }, TODAY_MS), 0);
  assert.equal(refactoredComputeRefund({ orderId: 2, ...fields }, TODAY_MS), 0);
});

test("currently an order exactly 14 days old gets a full refund", () => {
  const fields = { amountMinor: 10_000, purchasedAtMs: TODAY_MS - 14 * MS_PER_DAY, status: "active" };
  assert.equal(legacyComputeRefund({ orderId: 3, ...fields }, TODAY_MS), 10_000);
  assert.equal(refactoredComputeRefund({ orderId: 3, ...fields }, TODAY_MS), 10_000);
});

test("currently an order 15 days old refunds 90 percent", () => {
  const fields = { amountMinor: 10_000, purchasedAtMs: TODAY_MS - 15 * MS_PER_DAY, status: "active" };
  assert.equal(legacyComputeRefund({ orderId: 4, ...fields }, TODAY_MS), 9_000);
  assert.equal(refactoredComputeRefund({ orderId: 4, ...fields }, TODAY_MS), 9_000);
});

test("currently an order exactly 30 days old is not rounded down", () => {
  const fields = { amountMinor: 10_050, purchasedAtMs: TODAY_MS - 30 * MS_PER_DAY, status: "active" };
  assert.equal(legacyComputeRefund({ orderId: 5, ...fields }, TODAY_MS), 9_045);
  assert.equal(refactoredComputeRefund({ orderId: 5, ...fields }, TODAY_MS), 9_045);
});

test("currently an order older than 30 days rounds the refund down to the nearest hundred", () => {
  const fields = { amountMinor: 10_050, purchasedAtMs: TODAY_MS - 31 * MS_PER_DAY, status: "active" };
  assert.equal(legacyComputeRefund({ orderId: 6, ...fields }, TODAY_MS), 9_000);
  assert.equal(refactoredComputeRefund({ orderId: 6, ...fields }, TODAY_MS), 9_000);
});
