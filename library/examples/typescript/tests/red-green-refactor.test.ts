import assert from "node:assert/strict";
import { test } from "node:test";
import { Order as GreenOrder } from "../src/red-green-refactor/green.js";
import { Order as RedOrder } from "../src/red-green-refactor/red.js";
import { Order as RefactorOrder } from "../src/red-green-refactor/refactor.js";

test("red: cancelling a shipped order is still allowed — the new requirement fails here", () => {
  // The new rule doesn't exist yet: this passing test pins the flaw it will fix.
  const order = new RedOrder("shipped");
  order.cancel();
  assert.equal(order.status, "cancelled");
});

test("green: cancelling a pending order succeeds", () => {
  const order = new GreenOrder("pending");
  order.cancel();
  assert.equal(order.status, "cancelled");
});

test("green: cancelling a shipped order is rejected", () => {
  const order = new GreenOrder("shipped");
  assert.throws(() => order.cancel(), /shipped/);
  assert.equal(order.status, "shipped");
});

test("refactor: cancelling a pending order succeeds", () => {
  // Same case as green, run against the refactored design.
  const order = new RefactorOrder("pending");
  order.cancel();
  assert.equal(order.status, "cancelled");
});

test("refactor: cancelling a shipped order is rejected", () => {
  // Same case as green, run against the refactored design.
  const order = new RefactorOrder("shipped");
  assert.throws(() => order.cancel(), /shipped/);
  assert.equal(order.status, "shipped");
});
