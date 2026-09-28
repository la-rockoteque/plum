import assert from "node:assert/strict";
import { test } from "node:test";
import { Order as GreenOrder } from "../src/red-green-refactor/green.js";
import { Order as RedOrder } from "../src/red-green-refactor/red.js";
import { Order as RefactorOrder } from "../src/red-green-refactor/refactor.js";

test("red: cancelling a shipped order is still allowed", () => {
  // The new rule doesn't exist yet: this passing test pins the flaw it will fix.
  const order = new RedOrder("shipped");
  order.cancel();
  assert.equal(order.status, "cancelled");
});

type OrderCtor = new (status?: string) => { status: string; cancel(): void };

// One shared test body runs against both stages: green and refactor must behave identically.
const implementations: Array<[string, OrderCtor]> = [
  ["green", GreenOrder],
  ["refactor", RefactorOrder],
];

for (const [name, OrderImpl] of implementations) {
  test(`${name}: cancelling a pending order succeeds`, () => {
    const order = new OrderImpl("pending");
    order.cancel();
    assert.equal(order.status, "cancelled");
  });

  test(`${name}: cancelling a shipped order is rejected`, () => {
    const order = new OrderImpl("shipped");
    assert.throws(() => order.cancel(), /shipped/);
    assert.equal(order.status, "shipped");
  });
}
